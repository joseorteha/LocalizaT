from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import record
from notifications.models import Notification
from reports.models import Report

from .models import Claim
from .serializers import ClaimCreateSerializer, ClaimDecisionSerializer, ClaimListSerializer, ClaimSerializer


class ClaimsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Claim.objects.all() if request.user.is_staff else Claim.objects.filter(claimant=request.user)
        return Response(ClaimListSerializer(queryset.select_related("found_report", "handover").order_by("-created_at")[:100], many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = ClaimCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        found = get_object_or_404(Report.objects.select_for_update(), pk=data["found_report_id"], kind=Report.Kind.FOUND)
        if found.publication_status != Report.Publication.PUBLIC or found.status != Report.Status.ACTIVE:
            return Response({"error": "Este aviso ya no recibe solicitudes de devolución."}, status=409)
        if found.owner_id == request.user.pk:
            return Response({"error": "No puedes reclamar tu propio hallazgo."}, status=400)
        lost = None
        if data.get("lost_report_id"):
            lost = get_object_or_404(Report, pk=data["lost_report_id"], owner=request.user, kind=Report.Kind.LOST)
            if lost.status != Report.Status.ACTIVE:
                return Response({"error": "El reporte de pérdida debe estar activo."}, status=409)
        if Claim.objects.filter(found_report=found, claimant=request.user).exists():
            return Response({"error": "Ya solicitaste la devolución de este objeto. Revisa el estado en Mi espacio."}, status=409)
        if Claim.objects.filter(claimant=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count() >= 5:
            return Response({"error": "Ya enviaste cinco solicitudes de devolución en las últimas 24 horas. Inténtalo más tarde."}, status=429)
        claim = Claim.objects.create(found_report=found, lost_report=lost, claimant=request.user, evidence=data["evidence"])
        record(actor=request.user, action="claim.submitted", obj=claim)
        Notification.objects.create(
            recipient=found.owner, kind=Notification.Kind.CLAIM, title="Solicitaron la devolución de tu hallazgo",
            body="Una persona cree que el objeto es suyo. El equipo revisará su detalle privado antes de coordinar cualquier entrega.", report=found,
        )
        return Response(ClaimSerializer(claim).data, status=201)


def report_context(report, include_clue=False):
    if report is None:
        return None
    data = {
        "folio": report.folio,
        "description": report.description,
        "approximate_area": report.approximate_area,
        "occurred_on": report.occurred_on,
        "owner_email": report.owner.email,
    }
    if include_clue:
        private = getattr(report, "private", None)
        data["ownership_clue"] = private.ownership_clue if private else ""
    return data


class ClaimDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        queryset = Claim.objects.all() if request.user.is_staff else Claim.objects.filter(claimant=request.user)
        claim = get_object_or_404(queryset.select_related("claimant", "found_report__owner", "lost_report__owner"), pk=pk)
        data = ClaimSerializer(claim).data
        if request.user.is_staff and request.user.pk != claim.claimant_id:
            record(actor=request.user, action="claim.evidence_viewed", obj=claim)
            # Lo que el equipo necesita para comparar y para coordinar la entrega.
            data["verification"] = {
                "claimant_email": claim.claimant.email,
                "found": report_context(claim.found_report),
                "lost": report_context(claim.lost_report, include_clue=True),
            }
        return Response(data)


class ClaimDecisionView(APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, pk):
        serializer = ClaimDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        found_id = get_object_or_404(Claim, pk=pk).found_report_id
        found = Report.objects.select_for_update().get(pk=found_id)
        claim = Claim.objects.select_for_update().select_related("claimant").get(pk=pk)
        if claim.status not in (Claim.Status.SUBMITTED, Claim.Status.DISPUTED):
            return Response({"error": "Esta solicitud ya tiene una decisión. Revisa su estado en Mi espacio."}, status=409)
        decision = serializer.validated_data["decision"]
        if decision == "approve":
            if found.status != Report.Status.ACTIVE:
                return Response({"error": "El hallazgo ya está reservado o entregado."}, status=409)
            claim.status = Claim.Status.APPROVED
            found.status = Report.Status.RESERVED
            found.publication_status = Report.Publication.PRIVATE
            found.published_at = None
            found.save(update_fields=["status", "publication_status", "published_at"])
        elif decision == "reject":
            claim.status = Claim.Status.REJECTED
        else:
            claim.status = Claim.Status.DISPUTED
        claim.decided_by = request.user
        claim.decided_at = timezone.now()
        claim.decision_reason = serializer.validated_data["reason"]
        claim.save(update_fields=["status", "decided_by", "decided_at", "decision_reason"])
        record(actor=request.user, action=f"claim.{claim.status}", obj=claim)
        decision_messages = {
            "approve": "El equipo aprobó tu solicitud. Revisa la respuesta y espera la coordinación; la entrega aún no está confirmada.",
            "reject": "El equipo no pudo aprobar tu solicitud. Lee su respuesta en Mi espacio.",
            "dispute": "El equipo necesita revisar tu solicitud con más detalle. Lee su respuesta en Mi espacio.",
        }
        Notification.objects.create(
            recipient=claim.claimant, kind=Notification.Kind.CLAIM, title="Respuesta a tu solicitud de devolución",
            body=decision_messages[decision], report=found,
        )
        if decision == "approve":
            Notification.objects.create(
                recipient=found.owner, kind=Notification.Kind.CLAIM, title="Solicitud de devolución aprobada",
                body=(
                    "El equipo aprobó una solicitud sobre tu hallazgo. El punto de resguardo coordinará la entrega."
                    if found.holder == Report.Holder.POINT else
                    "El equipo aprobó una solicitud sobre tu hallazgo. Conserva el objeto y espera las indicaciones para coordinar la entrega."
                ), report=found,
            )
        return Response({"status": claim.status, "found_report_status": found.status})
