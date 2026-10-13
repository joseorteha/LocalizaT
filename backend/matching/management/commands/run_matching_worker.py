import time

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.utils import timezone

from reports.models import Report
from matching import embeddings
from matching.models import MatchingJob
from matching.services import process_next_job
from notifications.mail import process_next_email
from notifications.push import process_next_push

# El endpoint /api/health/ lee este latido para saber si el worker sigue vivo.
HEARTBEAT_KEY = "worker:heartbeat"


class Command(BaseCommand):
    help = "Procesa trabajos pendientes de coincidencias, avisos push y correos."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--interval", type=int, default=3)

    def handle(self, *args, **options):
        if settings.MATCHING_ENGINE == "semantic":
            # Cargar el modelo antes del primer reporte; la primera vez lo descarga.
            ready = embeddings.embed(["preparar el modelo"]) is not None
            self.stdout.write(f"Motor semántico {'listo' if ready else 'sin modelo: se usará el de reglas'}.")
        missing = Report.objects.filter(status=Report.Status.ACTIVE, matching_job__isnull=True).values_list("pk", flat=True)
        batch = []
        for pk in missing.iterator(chunk_size=500):
            batch.append(MatchingJob(report_id=pk))
            if len(batch) == 500:
                MatchingJob.objects.bulk_create(batch, ignore_conflicts=True)
                batch.clear()
        if batch:
            MatchingJob.objects.bulk_create(batch, ignore_conflicts=True)
        last_beat = 0.0
        while True:
            if time.monotonic() - last_beat > 30:
                try:
                    cache.set(HEARTBEAT_KEY, timezone.now().isoformat(), 300)
                except Exception:  # p. ej. la tabla de caché aún no existe al arrancar
                    pass
                last_beat = time.monotonic()
            processed = process_next_job()
            pushed = process_next_push()
            mailed = process_next_email()
            if options["once"]:
                return
            if not processed and not pushed and not mailed:
                time.sleep(max(1, options["interval"]))
