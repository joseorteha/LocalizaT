import json
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace

from django.conf import settings
from django.core.management.base import BaseCommand

from matching import embeddings
from matching.scoring import (
    SUGGESTION_THRESHOLD, canonical_text, lexical_similarity, score_pair,
    score_with_similarity, semantic_similarity,
)


DEFAULT_CASES = Path(__file__).resolve().parents[2] / "evaluation" / "casos_sierra.json"


class Command(BaseCommand):
    help = "Compara los motores de coincidencias con un conjunto de casos de prueba."

    def add_arguments(self, parser):
        parser.add_argument("--cases", default=str(DEFAULT_CASES))
        parser.add_argument("--model", default=settings.MATCHING_MODEL)
        parser.add_argument("--details", action="store_true", help="Muestra cada pérdida y sus sugerencias.")

    def handle(self, *args, **options):
        data = json.loads(Path(options["cases"]).read_text(encoding="utf-8"))
        base = date(2026, 10, 1)

        def report(item, kind, owner):
            return SimpleNamespace(
                id=item["id"], kind=kind, category=item["category"], description=item["description"],
                approximate_area=item["area"], occurred_on=base + timedelta(days=item["dias"]), owner_id=owner,
            )

        lost = [report(item, "lost", index) for index, item in enumerate(data["perdidas"])]
        found = [report(item, "found", 1000 + index) for index, item in enumerate(data["hallazgos"])]
        truth = {item["id"]: item["hallazgo"] for item in data["perdidas"]}

        settings.MATCHING_MODEL = options["model"]
        embeddings._model.cache_clear()
        everything = lost + found
        raw = embeddings.embed(item.description for item in everything)
        canonical = embeddings.embed(canonical_text(item.description) for item in everything)
        if raw is None:
            self.stderr.write("Sin modelo de lenguaje: solo se evalúan los motores de palabras.")
        raw_by_id = dict(zip((item.id for item in everything), raw or []))
        canonical_by_id = dict(zip((item.id for item in everything), canonical or []))

        def cos(table, a, b):
            return embeddings.cosine(table[a.id], table[b.id]) if table else None

        engines = {
            "Actual (palabras exactas)": lambda a, b: score_pair(a, b),
            "Palabras normalizadas": lambda a, b: score_with_similarity(a, b, lexical_similarity(a.description, b.description)),
        }
        if raw is not None:
            engines["Solo IA"] = lambda a, b: score_with_similarity(a, b, semantic_similarity(cos(raw_by_id, a, b)))
            engines["IA + palabras (texto original)"] = lambda a, b: score_with_similarity(
                a, b, (lexical_similarity(a.description, b.description) + semantic_similarity(cos(raw_by_id, a, b))) / 2)
            engines["IA + palabras (propuesto)"] = lambda a, b: score_with_similarity(
                a, b, (lexical_similarity(a.description, b.description) + semantic_similarity(cos(canonical_by_id, a, b))) / 2)

        with_truth = sum(1 for value in truth.values() if value)
        without_truth = len(truth) - with_truth
        self.stdout.write(f"\nCasos: {len(lost)} pérdidas ({with_truth} con su hallazgo, {without_truth} sin él) y {len(found)} hallazgos.")
        self.stdout.write(f"Modelo: {options['model'] if raw is not None else 'ninguno'}\n")
        header = f"{'Motor':34} {'Encuentra':>10} {'1.º lugar':>10} {'Falsas alarmas':>15} {'Precisión':>10}"
        self.stdout.write(header)
        self.stdout.write("-" * len(header))
        for name, engine in engines.items():
            hits = first = alarms = suggestions = 0
            details = []
            for item in lost:
                ranked = sorted(
                    ((engine(item, other)[0], other.id) for other in found),
                    reverse=True,
                )
                suggested = [(score, other) for score, other in ranked if score >= SUGGESTION_THRESHOLD]
                suggestions += len(suggested)
                expected = truth[item.id]
                hit = any(other == expected for _, other in suggested)
                hits += hit
                first += bool(suggested) and suggested[0][1] == expected
                alarms += len(suggested) - hit
                details.append((item, expected, suggested))
            precision = hits / suggestions if suggestions else 0
            self.stdout.write(
                f"{name:34} {hits:>4}/{with_truth:<5} {first:>4}/{with_truth:<5} {alarms:>15} {precision:>9.0%}"
            )
            if options["details"]:
                for item, expected, suggested in details:
                    shown = ", ".join(f"{other}:{score}" for score, other in suggested[:4]) or "—"
                    mark = "✓" if suggested and suggested[0][1] == expected else ("·" if expected is None and not suggested else "✗")
                    self.stdout.write(f"    {mark} {item.id} (espera {expected or 'nada'}): {shown}")
        self.stdout.write(
            "\nEncuentra: el hallazgo correcto aparece entre las sugerencias. 1.º lugar: aparece primero. "
            "Falsas alarmas: sugerencias de objetos que no eran. Casos ficticios: no miden la precisión en campo.\n"
        )
