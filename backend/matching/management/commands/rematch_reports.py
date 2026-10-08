from django.core.management.base import BaseCommand
from django.db import transaction

from matching.models import MatchingJob, MatchSuggestion
from reports.models import Report


class Command(BaseCommand):
    help = "Vuelve a poner en cola los reportes activos, p. ej. tras cambiar de motor o de diccionario."

    def add_arguments(self, parser):
        parser.add_argument(
            "--drop-pending", action="store_true",
            help="Borra antes las sugerencias pendientes (no las descartadas) para recalcularlas.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        active = Report.objects.filter(status=Report.Status.ACTIVE)
        dropped = 0
        if options["drop_pending"]:
            dropped, _ = MatchSuggestion.objects.filter(
                status=MatchSuggestion.Status.PENDING,
                lost_report__status=Report.Status.ACTIVE,
                found_report__status=Report.Status.ACTIVE,
            ).delete()
        existing = set(MatchingJob.objects.filter(report__in=active).values_list("report_id", flat=True))
        requeued = MatchingJob.objects.filter(report__in=active).update(status=MatchingJob.Status.QUEUED, attempts=0)
        created = MatchingJob.objects.bulk_create(
            [MatchingJob(report_id=pk) for pk in active.values_list("pk", flat=True) if pk not in existing],
        )
        self.stdout.write(
            f"En cola: {requeued + len(created)} reportes activos. Sugerencias pendientes borradas: {dropped}.",
        )
