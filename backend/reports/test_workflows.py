import uuid
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from claims.models import Claim
from audit.models import AuditEvent
from custody.models import CustodyPoint, CustodyRecord, Handover
from matching.models import MatchSuggestion
from matching.services import process_next_job
from notifications.models import Notification
from reports.models import Report


class RecoveryWorkflowTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.finder = user_model.objects.create_user(email="finder@example.com", password="StrongPass_2026!")
        self.claimant = user_model.objects.create_user(email="claimant@example.com", password="StrongPass_2026!")
        self.other = user_model.objects.create_user(email="other@example.com", password="StrongPass_2026!")
        self.staff = user_model.objects.create_superuser(email="staff@example.com", password="StrongPass_2026!")
        self.point_member = user_model.objects.create_user(email="point@example.com", password="StrongPass_2026!")
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def create_report(self, user, kind, description):
        self.as_user(user)
        response = self.client.post("/api/reports/", {
            "client_request_id": str(uuid.uuid4()),
            "kind": kind,
            "category": "bag",
            "description": description,
            "approximate_area": "Centro de Zongolica",
            "occurred_on": date.today().isoformat(),
            "ownership_clue": "Parche rojo escondido" if kind == "lost" else "",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return Report.objects.get(pk=response.data["id"])

    def publish(self, report):
        self.as_user(report.owner)
        requested = self.client.post(f"/api/reports/{report.pk}/publication/", {
            "public_summary": "Mochila de color azul encontrada cerca del centro",
            "public_area": "Zongolica centro",
        }, format="json")
        self.assertEqual(requested.status_code, 200, requested.data)
        self.as_user(self.staff)
        approved = self.client.post(f"/api/ops/reports/{report.pk}/publication/", {
            "decision": "approve", "reason": "Resumen público revisado",
        }, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        report.refresh_from_db()

    def test_public_catalogue_exposes_only_moderated_fields(self):
        found = self.create_report(self.finder, "found", "Mochila azul con número secreto 98765")
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 0)
        self.as_user(self.finder)
        self.client.post(f"/api/reports/{found.pk}/publication/", {
            "public_summary": "Mochila azul vista en el centro", "public_area": "Zongolica centro",
        }, format="json")
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 0)
        self.as_user(self.other)
        self.assertEqual(self.client.post(f"/api/ops/reports/{found.pk}/publication/", {
            "decision": "approve", "reason": "Intento sin permiso",
        }, format="json").status_code, 403)
        self.as_user(self.staff)
        self.assertEqual(self.client.post(f"/api/ops/reports/{found.pk}/publication/", {
            "decision": "approve", "reason": "Resumen seguro para publicar",
        }, format="json").status_code, 200)
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/public/reports/?kind=found&category=bag&area=Zongolica")
        self.assertEqual(response.data["count"], 1)
        item = response.data["results"][0]
        self.assertEqual(set(item), {"id", "kind", "category", "public_summary", "public_area", "occurred_on", "published_at"})
        self.assertNotIn("98765", str(item))
        self.assertEqual(self.client.get("/api/public/reports/?category=invalid").status_code, 400)
        self.assertEqual(self.client.get("/api/public/reports/?from=invalid").status_code, 400)
        self.as_user(self.finder)
        self.assertEqual(self.client.delete(f"/api/reports/{found.pk}/publication/").status_code, 200)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 0)

    def test_basic_notice_publishes_without_exposing_private_text(self):
        lost = self.create_report(self.claimant, "lost", "Mochila con mi nombre y teléfono adentro")
        self.as_user(self.claimant)
        response = self.client.post(f"/api/reports/{lost.pk}/publication/", {"mode": "instant"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["publication_status"], "public")
        self.assertEqual(response.data["public_summary"], "Se busca: mochila o bolsa")
        self.assertEqual(response.data["public_area"], "Sierra de Zongolica")
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 1)
        item = self.client.get(f"/api/public/reports/{lost.pk}/").data
        self.assertNotIn("teléfono", str(item))
        self.assertNotIn("nombre", str(item))
        self.assertNotIn("ownership_clue", item)
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/ops/publications/").data, [])
        visible = self.client.get("/api/ops/publications/?status=public")
        self.assertEqual(visible.status_code, 200)
        self.assertEqual(visible.data[0]["id"], str(lost.pk))
        self.assertEqual(self.client.get("/api/ops/publications/?status=invalid").status_code, 400)
        self.as_user(self.claimant)
        self.assertEqual(self.client.post(f"/api/reports/{lost.pk}/publication/", {
            "mode": "instant", "public_summary": "Texto arbitrario",
        }, format="json").status_code, 400)
        self.as_user(self.staff)
        hidden = self.client.post(f"/api/ops/reports/{lost.pk}/publication/", {
            "decision": "hide", "reason": "Se retiró el aviso para revisar un reporte de abuso",
        }, format="json")
        self.assertEqual(hidden.status_code, 200)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/public/reports/{lost.pk}/").status_code, 404)
        self.as_user(self.claimant)
        self.assertEqual(self.client.post(f"/api/reports/{lost.pk}/publication/", {
            "mode": "instant",
        }, format="json").status_code, 409)

    def test_reviewed_notice_can_be_replaced_with_basic_but_rejected_notice_cannot(self):
        first = self.create_report(self.claimant, "lost", "Mochila azul con cierre gris")
        self.as_user(self.claimant)
        self.client.post(f"/api/reports/{first.pk}/publication/", {
            "mode": "review", "public_summary": "Busco una mochila azul", "public_area": "Zongolica centro",
        }, format="json")
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 0)
        self.assertEqual(self.client.post(f"/api/reports/{first.pk}/publication/", {
            "mode": "instant",
        }, format="json").data["publication_status"], "public")
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/ops/publications/").data, [])
        second = self.create_report(self.claimant, "found", "Encontré una mochila de prueba")
        self.as_user(self.claimant)
        self.client.post(f"/api/reports/{second.pk}/publication/", {
            "mode": "review", "public_summary": "Encontré una mochila azul", "public_area": "Zongolica centro",
        }, format="json")
        self.as_user(self.staff)
        self.client.post(f"/api/ops/reports/{second.pk}/publication/", {
            "decision": "reject", "reason": "El texto contiene un detalle privado",
        }, format="json")
        self.as_user(self.claimant)
        self.assertEqual(self.client.post(f"/api/reports/{second.pk}/publication/", {
            "mode": "instant",
        }, format="json").status_code, 409)

    def test_owner_can_close_active_report_and_staff_has_operational_queue(self):
        found = self.create_report(self.finder, "found", "Mochila azul de prueba para cerrar")
        self.as_user(self.finder)
        self.client.post(f"/api/reports/{found.pk}/publication/", {
            "public_summary": "Mochila azul vista en el centro", "public_area": "Zongolica centro",
        }, format="json")
        self.as_user(self.other)
        self.assertEqual(self.client.get("/api/ops/publications/").status_code, 403)
        self.assertEqual(self.client.get("/api/ops/metrics/").status_code, 403)
        self.as_user(self.staff)
        queue = self.client.get("/api/ops/publications/").data
        self.assertEqual(len(queue), 1)
        self.assertNotIn("ownership_clue", queue[0])
        self.assertEqual(self.client.get("/api/ops/metrics/").data["publications_pending"], 1)
        self.as_user(self.finder)
        self.assertEqual(self.client.post(f"/api/reports/{found.pk}/close/", {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"/api/reports/{found.pk}/close/", {}, format="json").status_code, 409)
        found.refresh_from_db()
        self.assertEqual(found.status, Report.Status.CLOSED)
        self.assertEqual(found.publication_status, Report.Publication.PRIVATE)

    def test_matching_worker_and_counterpart_privacy(self):
        lost = self.create_report(self.claimant, "lost", "Mochila azul con cierre gris y parche privado")
        found = self.create_report(self.finder, "found", "Encontré mochila azul con cierre gris")
        self.assertTrue(process_next_job())
        self.assertTrue(process_next_job())
        self.assertFalse(process_next_job())
        self.assertEqual(MatchSuggestion.objects.count(), 1)
        self.as_user(self.claimant)
        hidden = self.client.get(f"/api/reports/{lost.pk}/suggestions/").data[0]
        self.assertIsNone(hidden["counterpart"])
        self.assertTrue(hidden["requires_operator_review"])
        self.publish(found)
        self.as_user(self.claimant)
        visible = self.client.get(f"/api/reports/{lost.pk}/suggestions/").data[0]
        self.assertEqual(visible["counterpart"]["id"], str(found.pk))
        self.assertNotIn("description", visible["counterpart"])
        self.assertTrue(Notification.objects.filter(recipient=self.claimant, kind=Notification.Kind.MATCH).exists())
        self.as_user(self.staff)
        suggestion = MatchSuggestion.objects.get()
        self.assertEqual(self.client.post(f"/api/ops/suggestions/{suggestion.pk}/review/", {"decision": "dismiss"}, format="json").status_code, 200)
        self.as_user(self.claimant)
        self.assertEqual(self.client.get(f"/api/reports/{lost.pk}/suggestions/").data, [])

    def test_report_list_counts_only_visible_pending_matches(self):
        lost = self.create_report(self.claimant, "lost", "Mochila azul con cierre gris y parche privado")
        found = self.create_report(self.finder, "found", "Encontré mochila azul con cierre gris")
        while process_next_job():
            pass
        self.as_user(self.claimant)
        self.assertEqual(self.client.get("/api/reports/").data[0]["match_count"], 0)
        self.publish(found)
        self.as_user(self.claimant)
        self.assertEqual(self.client.get("/api/reports/").data[0]["match_count"], 1)
        self.assertEqual(self.client.get(f"/api/reports/{lost.pk}/").data["match_count"], 1)
        MatchSuggestion.objects.update(status=MatchSuggestion.Status.DISMISSED)
        self.assertEqual(self.client.get("/api/reports/").data[0]["match_count"], 0)

    def test_staff_claim_detail_includes_verification_context_only_for_staff(self):
        lost = self.create_report(self.claimant, "lost", "Mochila azul con cierre gris")
        found = self.create_report(self.finder, "found", "Mochila azul con cierre gris hallada")
        self.publish(found)
        self.as_user(self.claimant)
        claim_id = self.client.post("/api/claims/", {
            "found_report_id": str(found.pk), "lost_report_id": str(lost.pk),
            "evidence": "Tiene un parche rojo cosido dentro del bolsillo lateral.",
        }, format="json").data["id"]
        own_view = self.client.get(f"/api/claims/{claim_id}/").data
        self.assertNotIn("verification", own_view)
        self.as_user(self.staff)
        verification = self.client.get(f"/api/claims/{claim_id}/").data["verification"]
        self.assertEqual(verification["claimant_email"], self.claimant.email)
        self.assertEqual(verification["found"]["owner_email"], self.finder.email)
        self.assertEqual(verification["found"]["description"], found.description)
        self.assertNotIn("ownership_clue", verification["found"])
        self.assertEqual(verification["lost"]["ownership_clue"], "Parche rojo escondido")

    def test_claim_review_custody_and_single_confirmed_handover(self):
        lost = self.create_report(self.claimant, "lost", "Mochila azul con cierre gris")
        found = self.create_report(self.finder, "found", "Mochila azul con cierre gris hallada")
        self.publish(found)
        point = CustodyPoint.objects.create(name="Punto de prueba", public_area="Zongolica", active=True)
        point.members.add(self.point_member)
        self.as_user(self.point_member)
        intake = self.client.post("/api/custody/intake/", {
            "folio": found.folio.lower(), "point_id": point.pk, "note": "Objeto recibido y resguardado",
        }, format="json")
        self.assertEqual(intake.status_code, 201, intake.data)
        inventory = self.client.get("/api/custody/inventory/").data
        self.assertEqual([item["folio"] for item in inventory], [found.folio])
        self.assertNotIn("ownership_clue", inventory[0])
        self.as_user(self.other)
        self.assertEqual(self.client.get("/api/custody/inventory/").status_code, 403)
        self.as_user(self.claimant)
        created = self.client.post("/api/claims/", {
            "found_report_id": str(found.pk), "lost_report_id": str(lost.pk),
            "evidence": "Tiene un parche rojo cosido dentro del bolsillo lateral.",
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["found_summary"]["id"], str(found.pk))
        self.assertNotIn("description", created.data["found_summary"])
        self.assertIsNone(created.data["handover"])
        claim_id = created.data["id"]
        self.as_user(self.other)
        self.assertEqual(self.client.get(f"/api/claims/{claim_id}/").status_code, 404)
        second = self.client.post("/api/claims/", {
            "found_report_id": str(found.pk), "evidence": "Puedo describir el interior y el contenido exacto.",
        }, format="json")
        self.assertEqual(second.status_code, 201)
        self.as_user(self.finder)
        self.assertEqual(self.client.get("/api/claims/").data, [])
        self.as_user(self.staff)
        self.assertEqual(self.client.get(f"/api/claims/{claim_id}/").status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(action="claim.evidence_viewed", object_id=str(claim_id)).exists())
        approved = self.client.post(f"/api/ops/claims/{claim_id}/decision/", {
            "decision": "approve", "reason": "Detalle privado comprobado por el equipo",
        }, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        conflict = self.client.post(f"/api/ops/claims/{second.data['id']}/decision/", {
            "decision": "approve", "reason": "Segundo intento para el mismo hallazgo",
        }, format="json")
        self.assertEqual(conflict.status_code, 409)
        self.as_user(self.point_member)
        started = self.client.post("/api/handovers/", {
            "claim_id": claim_id, "note": "Objeto mostrado y preparado para entrega",
        }, format="json")
        self.assertEqual(started.status_code, 201, started.data)
        handover_id = started.data["handover_id"]
        self.assertEqual(len(self.client.get("/api/handovers/").data), 1)
        point.active = False
        point.save(update_fields=["active"])
        self.assertEqual(self.client.get("/api/handovers/").data, [])
        self.assertEqual(self.client.get("/api/custody/inventory/").status_code, 403)
        point.active = True
        point.save(update_fields=["active"])
        self.as_user(self.other)
        self.assertEqual(self.client.get("/api/handovers/").data, [])
        self.assertEqual(self.client.post(f"/api/handovers/{handover_id}/confirm/", {}, format="json").status_code, 404)
        self.as_user(self.claimant)
        handovers = self.client.get("/api/handovers/").data
        self.assertEqual(handovers[0]["id"], handover_id)
        self.assertNotIn("evidence", handovers[0])
        claim_detail = self.client.get(f"/api/claims/{claim_id}/").data
        self.assertEqual(claim_detail["handover"]["status"], "pending")
        confirmed = self.client.post(f"/api/handovers/{handover_id}/confirm/", {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(self.client.post(f"/api/handovers/{handover_id}/confirm/", {}, format="json").status_code, 409)
        found.refresh_from_db()
        lost.refresh_from_db()
        self.assertEqual((found.status, lost.status), (Report.Status.RETURNED, Report.Status.RETURNED))
        self.assertIsNotNone(CustodyRecord.objects.get(report=found).released_at)
        self.as_user(self.point_member)
        self.assertEqual(self.client.get("/api/custody/inventory/").data, [])
        self.assertEqual(Handover.objects.filter(report=found).count(), 1)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/public/reports/").data["count"], 0)
