from django.db.models import Count
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from claims.models import Claim
from custody.models import Handover
from matching.models import MatchSuggestion, MatchingJob
from reports.models import Report


class MetricsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            "reports_by_status": dict(Report.objects.values_list("status").annotate(total=Count("id"))),
            "public_reports": Report.objects.filter(publication_status=Report.Publication.PUBLIC).count(),
            "publications_pending": Report.objects.filter(publication_status=Report.Publication.PENDING).count(),
            "suggestions_pending": MatchSuggestion.objects.filter(status=MatchSuggestion.Status.PENDING).count(),
            "matching_jobs_queued": MatchingJob.objects.filter(status=MatchingJob.Status.QUEUED).count(),
            "matching_jobs_failed": MatchingJob.objects.filter(status=MatchingJob.Status.FAILED).count(),
            "claims_by_status": dict(Claim.objects.values_list("status").annotate(total=Count("id"))),
            "handovers_confirmed": Handover.objects.filter(status=Handover.Status.CONFIRMED).count(),
        })
