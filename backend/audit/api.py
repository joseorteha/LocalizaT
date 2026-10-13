import logging
from datetime import timedelta
from statistics import median

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncWeek
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from claims.models import Claim
from custody.models import Handover
from matching.models import MatchSuggestion, MatchingJob
from notifications.models import EmailDelivery
from reports.geography import municipality_for_area
from reports.models import AbuseReport, Report

from .models import Feedback

log = logging.getLogger("localizat.client")


class MetricsView(APIView):
    """Cifras agregadas para el equipo y para informes (NAUFest). Nunca datos de personas."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        users = get_user_model().objects
        reports = Report.objects.all()
        by_kind = dict(reports.values_list("kind").annotate(total=Count("id")))

        weeks = []
        start = now - timedelta(weeks=8)
        rows = (reports.filter(created_at__gte=start).annotate(week=TruncWeek("created_at"))
                .values("week", "kind").annotate(total=Count("id")))
        table = {}
        for row in rows:
            key = row["week"].date().isoformat()
            table.setdefault(key, {"week": key, "lost": 0, "found": 0})[row["kind"]] = row["total"]
        weeks = sorted(table.values(), key=lambda item: item["week"])

        places = {}
        for public_area, approximate_area in reports.values_list("public_area", "approximate_area"):
            name = municipality_for_area(public_area) or municipality_for_area(approximate_area) or "Sin municipio"
            places[name] = places.get(name, 0) + 1

        lost_active = reports.filter(kind=Report.Kind.LOST)
        lost_with_match = MatchSuggestion.objects.values("lost_report").distinct().count()

        days_to_return = []
        for handover in Handover.objects.filter(status=Handover.Status.CONFIRMED, confirmed_at__isnull=False).select_related(
                "claim__lost_report", "report"):
            origin = handover.claim.lost_report or handover.report
            days_to_return.append((handover.confirmed_at - origin.created_at).total_seconds() / 86400)

        return Response({
            # Compatibles con el panel anterior
            "reports_by_status": dict(reports.values_list("status").annotate(total=Count("id"))),
            "public_reports": reports.filter(publication_status=Report.Publication.PUBLIC).count(),
            "publications_pending": reports.filter(publication_status=Report.Publication.PENDING).count(),
            "suggestions_pending": MatchSuggestion.objects.filter(status=MatchSuggestion.Status.PENDING).count(),
            "matching_jobs_queued": MatchingJob.objects.filter(status=MatchingJob.Status.QUEUED).count(),
            "matching_jobs_failed": MatchingJob.objects.filter(status=MatchingJob.Status.FAILED).count(),
            "claims_by_status": dict(Claim.objects.values_list("status").annotate(total=Count("id"))),
            "handovers_confirmed": Handover.objects.filter(status=Handover.Status.CONFIRMED).count(),
            # Nuevas
            "generated_at": now,
            "users_total": users.count(),
            "users_verified": users.filter(email_verified=True).count(),
            "users_new_30d": users.filter(date_joined__gte=now - timedelta(days=30)).count(),
            "reports_total": reports.count(),
            "reports_lost": by_kind.get(Report.Kind.LOST, 0),
            "reports_found": by_kind.get(Report.Kind.FOUND, 0),
            "reports_new_7d": reports.filter(created_at__gte=now - timedelta(days=7)).count(),
            "reports_new_30d": reports.filter(created_at__gte=now - timedelta(days=30)).count(),
            "reports_by_category": dict(reports.values_list("category").annotate(total=Count("id"))),
            "reports_by_municipality": dict(sorted(places.items(), key=lambda item: -item[1])),
            "reports_by_week": weeks,
            "suggestions_total": MatchSuggestion.objects.count(),
            "lost_with_suggestion": lost_with_match,
            "lost_total": lost_active.count(),
            "returned_total": reports.filter(status=Report.Status.RETURNED).count(),
            "median_days_to_return": round(median(days_to_return), 1) if days_to_return else None,
            "abuse_open": AbuseReport.objects.filter(status=AbuseReport.Status.OPEN).values("report").distinct().count(),
            "feedback_open": Feedback.objects.filter(resolved=False).count(),
            "emails_pending": EmailDelivery.objects.filter(status__in=["pending", "sending"]).count(),
            "emails_failed": EmailDelivery.objects.filter(status="failed").count(),
        })


class FeedbackView(APIView):
    """«¿Algo no se entendió?»: cualquiera puede dejar un comentario, con o sin cuenta."""

    permission_classes = [AllowAny]
    throttle_scope = "feedback"

    def post(self, request):
        mood = request.data.get("mood")
        message = str(request.data.get("message", "")).strip()
        if mood not in Feedback.Mood.values:
            return Response({"error": "Elige de qué se trata tu comentario."}, status=400)
        if len(message) < 4:
            return Response({"error": "Cuéntanos un poco más."}, status=400)
        Feedback.objects.create(
            user=request.user if request.user.is_authenticated else None,
            mood=mood, message=message[:600],
            page=str(request.data.get("page", ""))[:120],
            device=str(request.META.get("HTTP_USER_AGENT", ""))[:200],
            connection=str(request.data.get("connection", ""))[:20],
        )
        return Response({"ok": True}, status=201)


class FeedbackQueueView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        items = Feedback.objects.filter(resolved=False)[:100]
        return Response([{
            "id": item.pk, "mood": item.mood, "mood_label": item.get_mood_display(), "message": item.message,
            "page": item.page, "device": item.device, "connection": item.connection,
            "has_account": item.user_id is not None, "created_at": item.created_at,
        } for item in items])


class FeedbackResolveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        item = get_object_or_404(Feedback, pk=pk)
        item.resolved = True
        item.save(update_fields=["resolved"])
        return Response({"ok": True})


class ClientErrorView(APIView):
    """Errores de JavaScript que ven las personas. Se registran (y van a Sentry si está activo)."""

    permission_classes = [AllowAny]
    # Llega con sendBeacon, sin token CSRF: no usa la sesión (no puede cambiar nada).
    authentication_classes = []
    throttle_scope = "client_error"

    def post(self, request):
        message = str(request.data.get("message", ""))[:300]
        if not message:
            return Response(status=204)
        page = str(request.data.get("page", ""))[:120]
        stack = str(request.data.get("stack", ""))[:2000]
        log.warning("Error en el navegador: %s | página %s\n%s", message, page, stack)
        try:
            import sentry_sdk

            with sentry_sdk.new_scope() as scope:
                scope.set_tag("origen", "navegador")
                scope.set_context("navegador", {"pagina": page, "pila": stack})
                sentry_sdk.capture_message(f"[navegador] {message}", level="error")
        except Exception:
            pass
        return Response(status=204)
