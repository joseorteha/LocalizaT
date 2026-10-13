"""Arma un conjunto de evaluación con casos REALES ya resueltos, en el mismo formato
que usa `evaluate_matching` (casos_sierra.json).

Verdad de cada pérdida:
  · Devolución confirmada (o reclamación aprobada) que la une a un hallazgo → ese hallazgo.
  · Con --incluir-sin-par: pérdidas cerradas sin reclamación aprobada → «sin hallazgo».

Las descripciones son datos privados de las personas: el archivo se queda en el
servidor (o en tu computadora) y NUNCA se sube a Git. Los folios no se exportan.

  python manage.py export_matching_cases --salida /tmp/casos_reales.json
  python manage.py evaluate_matching --cases /tmp/casos_reales.json --details
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from claims.models import Claim
from reports.models import Report


class Command(BaseCommand):
    help = "Exporta pares reales (pérdida ↔ hallazgo) resueltos para medir el motor de coincidencias."

    def add_arguments(self, parser):
        parser.add_argument("--salida", required=True, help="Ruta del archivo JSON a crear.")
        parser.add_argument("--incluir-sin-par", action="store_true",
                            help="Agrega pérdidas cerradas sin devolución como casos «sin hallazgo».")

    def handle(self, *args, **options):
        resolved = (Claim.objects.filter(status=Claim.Status.APPROVED, lost_report__isnull=False)
                    .select_related("lost_report", "found_report"))
        truth = {claim.lost_report_id: claim.found_report_id for claim in resolved}
        lost_reports = list(Report.objects.filter(pk__in=truth.keys()))
        if options["incluir_sin_par"]:
            lost_reports += list(Report.objects.filter(kind=Report.Kind.LOST, status=Report.Status.CLOSED)
                                 .exclude(pk__in=truth.keys()))
        found_reports = list(Report.objects.filter(kind=Report.Kind.FOUND))
        if not lost_reports:
            raise CommandError("Todavía no hay devoluciones aprobadas con su reporte de pérdida. Vuelve cuando el piloto tenga casos.")

        everything = lost_reports + found_reports
        base = min(report.occurred_on for report in everything)
        found_ids = {report.pk: f"H{index + 1}" for index, report in enumerate(found_reports)}

        def item(report, key):
            return {"id": key, "category": report.category, "description": report.description,
                    "area": report.approximate_area, "dias": (report.occurred_on - base).days}

        data = {
            "nota": "Casos reales exportados de LocalizaT. Datos privados: no compartir ni subir a Git.",
            "perdidas": [
                {**item(report, f"P{index + 1}"), "hallazgo": found_ids.get(truth.get(report.pk))}
                for index, report in enumerate(lost_reports)
            ],
            "hallazgos": [item(report, found_ids[report.pk]) for report in found_reports],
        }
        path = Path(options["salida"])
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        with_pair = sum(1 for case in data["perdidas"] if case["hallazgo"])
        self.stdout.write(self.style.SUCCESS(
            f"Listo: {len(data['perdidas'])} pérdidas ({with_pair} con su hallazgo real) y "
            f"{len(data['hallazgos'])} hallazgos en {path}."
        ))
        self.stdout.write(f"Mídelo con: python manage.py evaluate_matching --cases {path} --details")
