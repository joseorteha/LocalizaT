from datetime import date, timedelta

from django.db import IntegrityError, connection, transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import record
from notifications.models import Notification
from .models import Report
from .geography import MUNICIPALITIES, marker_coordinates, municipality_for_area
from .serializers import (
    PublicReportSerializer, PublicationDecisionSerializer, PublicationRequestSerializer,
    ReportSerializer,
)


@require_GET
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def matches_existing(report, data):
    fields = ("kind", "category", "description", "approximate_area", "occurred_on", "holder")
    return all(getattr(report, field) == data.get(field, "") for field in fields) and (
        report.private.ownership_clue == data.get("ownership_clue", "")
    )


def with_match_count(queryset):
    # Cuenta las coincidencias pendientes cuya contraparte ya es visible, igual
    # que las que muestra OwnSuggestionsView. Un reporte es pérdida o hallazgo,
    # así que solo una de las dos cuentas puede ser distinta de cero.
    lost_side = Q(lost_suggestions__status="pending",
                  lost_suggestions__found_report__publication_status=Report.Publication.PUBLIC,
                  lost_suggestions__found_report__status=Report.Status.ACTIVE)
    found_side = Q(found_suggestions__status="pending",
                   found_suggestions__lost_report__publication_status=Report.Publication.PUBLIC,
                   found_suggestions__lost_report__status=Report.Status.ACTIVE)
    return queryset.annotate(
        lost_matches=Count("lost_suggestions", filter=lost_side, distinct=True),
        found_matches=Count("found_suggestions", filter=found_side, distinct=True),
    )


class ReportListCreateView(generics.ListCreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return with_match_count(Report.objects.filter(owner=self.request.user))

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        existing = Report.objects.filter(owner=request.user, client_request_id=data["client_request_id"]).first()
        if existing:
            if not matches_existing(existing, data):
                return Response({"error": "La clave de reintento ya pertenece a otro reporte."}, status=status.HTTP_409_CONFLICT)
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        try:
            report = serializer.save(owner=request.user)
        except IntegrityError:
            existing = Report.objects.get(owner=request.user, client_request_id=data["client_request_id"])
            if not matches_existing(existing, data):
                return Response({"error": "La clave de reintento ya pertenece a otro reporte."}, status=status.HTTP_409_CONFLICT)
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        from matching.models import MatchingJob
        MatchingJob.objects.get_or_create(report=report)
        record(actor=request.user, action="report.created", obj=report)
        return Response(self.get_serializer(report).data, status=status.HTTP_201_CREATED)


class ReportDetailView(generics.RetrieveAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return with_match_count(Report.objects.filter(owner=self.request.user))


class PublicPage(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class PublicReportListView(generics.ListAPIView):
    serializer_class = PublicReportSerializer
    permission_classes = [AllowAny]
    pagination_class = PublicPage

    def get_queryset(self):
        queryset = Report.objects.filter(
            publication_status=Report.Publication.PUBLIC,
            status=Report.Status.ACTIVE,
        )
        kind = self.request.query_params.get("kind", "")
        category = self.request.query_params.get("category", "")
        area = self.request.query_params.get("area", "").strip()[:80]
        query = self.request.query_params.get("q", "").strip()[:80]
        start = self.request.query_params.get("from", "")
        end = self.request.query_params.get("to", "")
        if kind and kind not in Report.Kind.values:
            raise ValidationError({"kind": "Tipo no reconocido."})
        if category and category not in Report.Category.values:
            raise ValidationError({"category": "Categoría no reconocida."})
        if kind:
            queryset = queryset.filter(kind=kind)
        if category:
            queryset = queryset.filter(category=category)
        if area:
            queryset = queryset.filter(public_area__icontains=area)
        if query:
            queryset = queryset.filter(Q(public_summary__icontains=query) | Q(public_area__icontains=query))
        try:
            if start:
                queryset = queryset.filter(occurred_on__gte=date.fromisoformat(start))
            if end:
                queryset = queryset.filter(occurred_on__lte=date.fromisoformat(end))
        except ValueError:
            raise ValidationError({"date": "Usa fechas con formato AAAA-MM-DD."})
        return queryset.order_by("-published_at", "-created_at")


class PublicReportDetailView(generics.RetrieveAPIView):
    serializer_class = PublicReportSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Report.objects.filter(publication_status=Report.Publication.PUBLIC, status=Report.Status.ACTIVE)


class PublicReportMapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Report.objects.filter(publication_status=Report.Publication.PUBLIC, status=Report.Status.ACTIVE)
        kind = request.query_params.get("kind", "")
        category = request.query_params.get("category", "")
        area = request.query_params.get("area", "").strip()[:80]
        query = request.query_params.get("q", "").strip()[:80]
        start = request.query_params.get("from", "")
        end = request.query_params.get("to", "")
        if kind and kind not in Report.Kind.values:
            raise ValidationError({"kind": "Tipo no reconocido."})
        if category and category not in Report.Category.values:
            raise ValidationError({"category": "Categoría no reconocida."})
        if kind:
            queryset = queryset.filter(kind=kind)
        if category:
            queryset = queryset.filter(category=category)
        if area:
            queryset = queryset.filter(public_area__icontains=area)
        if query:
            queryset = queryset.filter(Q(public_summary__icontains=query) | Q(public_area__icontains=query))
        try:
            if start:
                queryset = queryset.filter(occurred_on__gte=date.fromisoformat(start))
            if end:
                queryset = queryset.filter(occurred_on__lte=date.fromisoformat(end))
        except ValueError:
            raise ValidationError({"date": "Usa fechas con formato AAAA-MM-DD."})
        counts = {name: {"lost": 0, "found": 0} for name in MUNICIPALITIES}
        without_municipality = 0
        for item in queryset.values("public_area", "kind"):
            name = municipality_for_area(item["public_area"])
            if name:
                counts[name][item["kind"]] += 1
            else:
                without_municipality += 1
        zones = [
            {"name": name, "coordinates": marker_coordinates(name), **counts[name],
             "total": counts[name]["lost"] + counts[name]["found"]}
            for name in MUNICIPALITIES if counts[name]["lost"] or counts[name]["found"]
        ]
        return Response({"zones": zones, "without_municipality": without_municipality})


PUBLIC_CATEGORY_NAME = {
    Report.Category.BAG: "mochila o bolsa",
    Report.Category.CLOTHING: "prenda de ropa",
    Report.Category.ACCESSORY: "accesorio",
    Report.Category.BOOK: "libro o cuaderno",
    Report.Category.PHONE: "celular",
    Report.Category.CREDENTIAL: "credencial",
    Report.Category.DOCUMENT: "documento",
    Report.Category.OTHER: "objeto",
}


def notify_visible_matches(report):
    from matching.models import MatchSuggestion
    suggestions = MatchSuggestion.objects.filter(lost_report=report) if report.kind == Report.Kind.LOST else MatchSuggestion.objects.filter(found_report=report)
    for suggestion in suggestions.select_related("lost_report", "found_report").filter(status=MatchSuggestion.Status.PENDING)[:100]:
        counterpart = suggestion.found_report if report.kind == Report.Kind.LOST else suggestion.lost_report
        Notification.objects.create(
            recipient=counterpart.owner, kind=Notification.Kind.MATCH,
            title="Posible coincidencia",
            body="Hay un aviso público que podría corresponder a tu reporte. Revísalo en Mi espacio; el parecido no confirma que sea el mismo objeto.", report=counterpart,
        )


class PublicationRequestView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk, owner=request.user)
        if report.status != Report.Status.ACTIVE:
            return Response({"error": "Solo puedes publicar un reporte activo."}, status=409)
        serializer = PublicationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data["mode"]
        was_public = report.publication_status == Report.Publication.PUBLIC
        if mode == "instant":
            if report.publication_status == Report.Publication.REJECTED or (
                report.publication_status == Report.Publication.PRIVATE and report.publication_review_reason
            ):
                return Response({"error": "El equipo restringió este aviso. Corrígelo o consulta el motivo antes de volver a publicarlo."}, status=409)
            if not was_public and Report.objects.filter(
                owner=request.user, publication_status=Report.Publication.PUBLIC,
                published_at__gte=timezone.now() - timedelta(days=1),
            ).exclude(pk=report.pk).count() >= 5:
                return Response({"error": "Llegaste al límite de avisos inmediatos de hoy. Puedes enviar este aviso a revisión."}, status=429)
            verb = "Se busca" if report.kind == Report.Kind.LOST else "Se encontró"
            report.public_summary = f"{verb}: {PUBLIC_CATEGORY_NAME[report.category]}"
            report.public_area = serializer.validated_data.get("municipality", "Sierra de Zongolica")
            report.publication_status = Report.Publication.PUBLIC
        else:
            report.public_summary = serializer.validated_data["public_summary"]
            report.public_area = serializer.validated_data["public_area"]
            report.publication_status = Report.Publication.PENDING
        report.publication_review_reason = ""
        report.published_at = timezone.now() if mode == "instant" else None
        report.save(update_fields=["public_summary", "public_area", "publication_status", "publication_review_reason", "published_at"])
        record(actor=request.user, action="publication.auto_published" if mode == "instant" else "publication.requested", obj=report)
        if mode == "instant" and not was_public:
            notify_visible_matches(report)
        return Response({"publication_status": report.publication_status, "public_summary": report.public_summary, "public_area": report.public_area})

    @transaction.atomic
    def delete(self, request, pk):
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk, owner=request.user)
        report.publication_status = Report.Publication.PRIVATE
        report.published_at = None
        report.save(update_fields=["publication_status", "published_at"])
        record(actor=request.user, action="publication.withdrawn", obj=report)
        return Response({"publication_status": report.publication_status})


class PublicationReviewView(APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, pk):
        serializer = PublicationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk)
        decision = serializer.validated_data["decision"]
        if decision in ("approve", "reject") and report.publication_status != Report.Publication.PENDING:
            return Response({"error": "El reporte no está pendiente de revisión."}, status=409)
        if decision == "hide" and report.publication_status != Report.Publication.PUBLIC:
            return Response({"error": "El reporte no está publicado."}, status=409)
        if decision == "approve" and report.status != Report.Status.ACTIVE:
            return Response({"error": "El reporte ya no está activo."}, status=409)
        report.publication_status = {
            "approve": Report.Publication.PUBLIC,
            "reject": Report.Publication.REJECTED,
            "hide": Report.Publication.PRIVATE,
        }[decision]
        report.publication_review_reason = serializer.validated_data["reason"]
        report.published_at = timezone.now() if decision == "approve" else None
        report.save(update_fields=["publication_status", "publication_review_reason", "published_at"])
        record(actor=request.user, action=f"publication.{decision}", obj=report)
        Notification.objects.create(
            recipient=report.owner, kind=Notification.Kind.PUBLICATION,
            title="Revisamos tu aviso", body=f"El estado de tu aviso es: {report.get_publication_status_display()}. Abre tu reporte para ver el motivo y el siguiente paso.", report=report,
        )
        if decision == "approve":
            notify_visible_matches(report)
        return Response({"publication_status": report.publication_status})


class PendingPublicationsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        visibility = request.query_params.get("status", "pending")
        if visibility not in ("pending", "public"):
            return Response({"error": "Estado de aviso no reconocido."}, status=400)
        ordering = "created_at" if visibility == "pending" else "-published_at"
        reports = Report.objects.filter(publication_status=visibility, status=Report.Status.ACTIVE).order_by(ordering)[:100]
        return Response([{
            "id": str(item.pk), "kind": item.kind, "category": item.category,
            "public_summary": item.public_summary, "public_area": item.public_area,
            "description": item.description, "occurred_on": item.occurred_on,
            "publication_status": item.publication_status,
        } for item in reports])


class CloseOwnReportView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk, owner=request.user)
        if report.status != Report.Status.ACTIVE:
            return Response({"error": "Este reporte no puede cerrarse en su estado actual."}, status=409)
        report.status = Report.Status.CLOSED
        report.publication_status = Report.Publication.PRIVATE
        report.published_at = None
        report.save(update_fields=["status", "publication_status", "published_at"])
        record(actor=request.user, action="report.closed", obj=report)
        return Response({"status": report.status})
