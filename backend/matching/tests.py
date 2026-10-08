import uuid
from datetime import date
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings

from reports.models import Report

from . import embeddings, scoring
from .models import MatchSuggestion, ReportEmbedding
from .services import process_report


def case(kind, description, area="Zongolica", owner=1, category="bag", day=1):
    return SimpleNamespace(kind=kind, category=category, description=description, approximate_area=area,
                           occurred_on=date(2026, 10, day), owner_id=owner)


class NormalizationTests(SimpleTestCase):
    def test_accents_plurals_gender_and_diminutives_are_unified(self):
        self.assertEqual(scoring.tokens("Suéter"), scoring.tokens("sueter"))
        self.assertEqual(scoring.tokens("agujetas rojas"), {"agujet", "roj"})
        self.assertEqual(scoring.tokens("cordones rojos") & scoring.tokens("agujetas rojas"), {"roj"})
        self.assertEqual(scoring.tokens("mochilita"), scoring.tokens("mochilas"))

    def test_regional_words_share_one_form(self):
        self.assertEqual(scoring.tokens("morral"), scoring.tokens("bolsa"))
        self.assertEqual(scoring.tokens("cachucha"), scoring.tokens("gorra"))
        self.assertEqual(scoring.canonical_text("Chaqueta de jean"), "chamarra de mezclilla")


class SemanticScoreTests(SimpleTestCase):
    def test_same_category_and_day_is_not_enough_without_similar_description(self):
        lost = case("lost", "mochila rosa con princesas", owner=1)
        found = case("found", "bolsa de mano negra de piel", owner=2)
        # El motor original sugiere esto solo por categoría, fecha y zona.
        self.assertGreaterEqual(scoring.score_pair(lost, found)[0], scoring.SUGGESTION_THRESHOLD)
        self.assertEqual(scoring.score_pair_semantic(lost, found, cosine=0.40), (0, []))

    def test_similar_description_said_differently_is_suggested_and_ranked(self):
        lost = case("lost", "Cangurera negra con dos cierres", owner=1)
        right = case("found", "Riñonera de color negro, tiene dos compartimentos", owner=2, day=2)
        wrong = case("found", "mochila negra con tres cierres", owner=3)
        right_score, reasons = scoring.score_pair_semantic(lost, right, cosine=0.90)
        wrong_score, _ = scoring.score_pair_semantic(lost, wrong, cosine=0.55)
        self.assertGreaterEqual(right_score, scoring.SUGGESTION_THRESHOLD)
        self.assertIn("descripción parecida", reasons)
        self.assertGreater(right_score, wrong_score)

    def test_kind_category_owner_and_date_rules_still_apply(self):
        lost = case("lost", "mochila azul", owner=1)
        self.assertEqual(scoring.score_pair_semantic(lost, case("found", "mochila azul", owner=1), 0.99), (0, []))
        self.assertEqual(scoring.score_pair_semantic(lost, case("found", "mochila azul", owner=2, category="book"), 0.99), (0, []))
        self.assertEqual(scoring.score_pair_semantic(lost, case("found", "mochila azul", owner=2, day=30), 0.99), (0, []))

    def test_without_model_only_normalized_words_decide(self):
        lost = case("lost", "Sueter cafe tejido a mano", owner=1)
        found = case("found", "Suéter café de estambre hecho a mano", owner=2)
        self.assertGreaterEqual(scoring.score_pair_semantic(lost, found, cosine=None)[0], scoring.SUGGESTION_THRESHOLD)


def fake_embed(texts):
    # Vectores deterministas: dos textos se parecen si comparten la palabra «cangurera» o «rinonera».
    out = []
    for text in texts:
        bag = "cangurera" in text or "rinonera" in text
        out.append([1.0, 0.0] if bag else [0.0, 1.0])
    return out


@override_settings(MATCHING_ENGINE="semantic", MATCHING_MODEL="modelo-de-prueba")
class SemanticEngineTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.lost_owner = users.create_user(email="pierde@example.com", password="StrongPass_2026!")
        self.finder = users.create_user(email="encuentra@example.com", password="StrongPass_2026!")

    def report(self, owner, kind, description):
        report = Report.objects.create(
            client_request_id=uuid.uuid4(), owner=owner, kind=kind, category="bag", description=description,
            approximate_area="Zongolica", occurred_on=date.today(),
            holder=Report.Holder.FINDER if kind == "found" else "",
        )
        return report

    def test_engine_suggests_by_meaning_and_stores_vectors_once(self):
        lost = self.report(self.lost_owner, "lost", "Cangurera negra con dos cierres")
        match = self.report(self.finder, "found", "Riñonera de color negro")
        other = self.report(self.finder, "found", "mochila rosa de niña")
        with mock.patch.object(embeddings, "embed", side_effect=fake_embed) as embed:
            process_report(lost)
            process_report(lost)
        self.assertEqual(list(MatchSuggestion.objects.values_list("found_report_id", flat=True)), [match.pk])
        self.assertEqual(ReportEmbedding.objects.count(), 3)
        self.assertEqual(embed.call_count, 1)
        self.assertNotIn(other.pk, MatchSuggestion.objects.values_list("found_report_id", flat=True))

    def test_without_model_falls_back_to_rules_engine(self):
        lost = self.report(self.lost_owner, "lost", "mochila rosa")
        self.report(self.finder, "found", "bolsa de mano negra")
        with mock.patch.object(embeddings, "embed", return_value=None):
            process_report(lost)
        # El motor de reglas sugiere por categoría y fecha: no se pierden avisos si falla el modelo.
        self.assertEqual(MatchSuggestion.objects.count(), 1)
        self.assertFalse(ReportEmbedding.objects.exists())
