from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import record
from reports.models import Report
from reports.serializers import PublicReportSerializer, ReportSerializer

from .models import MatchSuggestion


def suggestion_data(suggestion, report, staff=False):
    counterpart = suggestion.found_report if report.kind == Report.Kind.LOST else suggestion.lost_report
    visible = staff or (counterpart.publication_status == Report.Publication.PUBLIC and counterpart.status == Report.Status.ACTIVE)
    return {
        "id": suggestion.pk,
        "reasons": suggestion.reasons,
        "status": suggestion.status,
        "counterpart": PublicReportSerializer(counterpart).data if visible else None,
        "requires_operator_review": not visible,
    }


class OwnSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        report = get_object_or_404(Report, pk=pk, owner=request.user)
        suggestions = MatchSuggestion.objects.filter(status=MatchSuggestion.Status.PENDING,
            lost_report__status=Report.Status.ACTIVE, found_report__status=Report.Status.ACTIVE)
        if report.kind == Report.Kind.LOST:
            suggestions = suggestions.filter(lost_report=report).select_related("found_report")
        else:
            suggestions = suggestions.filter(found_report=report).select_related("lost_report")
        return Response([suggestion_data(item, report) for item in suggestions.order_by("-score")[:30]])


class ReviewSuggestionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        suggestion = get_object_or_404(MatchSuggestion, pk=pk)
        if request.data.get("decision") != "dismiss":
            return Response({"error": "Decisión no reconocida."}, status=400)
        suggestion.status = MatchSuggestion.Status.DISMISSED
        suggestion.reviewed_by = request.user
        suggestion.reviewed_at = timezone.now()
        suggestion.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        record(actor=request.user, action="suggestion.dismissed", obj=suggestion)
        return Response({"status": suggestion.status})


class ReviewQueueView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        suggestions = MatchSuggestion.objects.filter(status=MatchSuggestion.Status.PENDING).select_related(
            "lost_report", "found_report",
        ).order_by("-score", "-created_at")[:100]
        return Response([{
            "id": item.pk,
            "lost_report_id": item.lost_report_id,
            "found_report_id": item.found_report_id,
            "score_internal": item.score,
            "reasons": item.reasons,
            "lost_report": ReportSerializer(item.lost_report).data,
            "found_report": ReportSerializer(item.found_report).data,
        } for item in suggestions])
