import json
import uuid
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.test import APIClient


def payload(**changes):
    data = {
        "client_request_id": str(uuid.uuid4()),
        "kind": "lost",
        "category": "bag",
        "description": "Mochila azul con cierre gris",
        "approximate_area": "Zona centro de Zongolica",
        "occurred_on": date.today().isoformat(),
        "ownership_clue": "Un parche cosido adentro",
    }
    data.update(changes)
    return data


class ReportApiTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(email="uno@example.com", password="Password123!unique")
        self.other = get_user_model().objects.create_user(email="dos@example.com", password="Password123!unique")
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_create_and_read_only_own_reports_without_private_clue(self):
        submitted = payload()
        created = self.client.post("/api/reports/", submitted, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data["folio"].startswith("LT-"))
        self.assertNotIn("ownership_clue", created.data)

        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get("/api/reports/").data, [])
        self.assertEqual(self.client.get(f"/api/reports/{created.data['id']}/").status_code, 404)

        self.client.force_authenticate(user=self.owner)
        self.assertEqual(len(self.client.get("/api/reports/").data), 1)
        self.assertNotIn("ownership_clue", self.client.get(f"/api/reports/{created.data['id']}/").data)

    def test_retry_uses_same_report_and_rejects_changed_payload(self):
        submitted = payload()
        first = self.client.post("/api/reports/", submitted, format="json")
        repeated = self.client.post("/api/reports/", submitted, format="json")
        changed = self.client.post("/api/reports/", {**submitted, "description": "Una mochila completamente distinta"}, format="json")
        self.assertEqual((first.status_code, repeated.status_code, changed.status_code), (201, 200, 409))
        self.assertEqual(first.data["id"], repeated.data["id"])

    def test_lost_requires_private_clue_and_future_date_is_rejected(self):
        no_clue = self.client.post("/api/reports/", payload(ownership_clue=""), format="json")
        future = self.client.post("/api/reports/", payload(occurred_on=(date.today() + timedelta(days=1)).isoformat()), format="json")
        self.assertEqual(no_clue.status_code, 400)
        self.assertEqual(future.status_code, 400)

    def test_found_report_records_finder_as_holder(self):
        response = self.client.post("/api/reports/", payload(kind="found", ownership_clue=""), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["holder"], "finder")

    def test_anonymous_cannot_list_or_create(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/reports/").status_code, (401, 403))
        self.assertIn(self.client.post("/api/reports/", payload(), format="json").status_code, (401, 403))


class AuthCsrfTests(TestCase):
    def test_signup_requires_csrf(self):
        browser = Client(enforce_csrf_checks=True)
        submitted = {"email": "nueva@example.com", "password": "Password123!unique"}
        no_token = browser.post("/api/auth/signup/", data=json.dumps(submitted), content_type="application/json")
        self.assertEqual(no_token.status_code, 403)
        token = browser.get("/api/auth/csrf/").json()["csrfToken"]
        with_token = browser.post(
            "/api/auth/signup/", data=json.dumps(submitted), content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(with_token.status_code, 201)
        self.assertEqual(browser.get("/api/auth/me/").json()["user"]["email"], submitted["email"])


class PublicMapTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="map@example.com", password="Password123!unique")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_map_groups_public_not_private_reports_without_precise_location(self):
        public = self.client.post("/api/reports/", payload(), format="json")
        private = self.client.post("/api/reports/", payload(category="book"), format="json")
        self.assertEqual((public.status_code, private.status_code), (201, 201))
        published = self.client.post(f"/api/reports/{public.data['id']}/publication/", {
            "mode": "instant", "municipality": "Zongolica",
        }, format="json")
        self.assertEqual(published.status_code, 200)
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/public/report-map/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["zones"][0]["name"], "Zongolica")
        self.assertEqual(response.data["zones"][0]["total"], 1)
        self.assertNotIn("description", str(response.data))
        self.assertEqual(self.client.get("/api/public/report-map/?category=book").data["zones"], [])
