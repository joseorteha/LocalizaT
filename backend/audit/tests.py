from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import Feedback


class OperationsInsightTests(TestCase):
    def setUp(self):
        cache.clear()
        users = get_user_model().objects
        self.staff = users.create_superuser(email="equipo@example.com", password="StrongPass_2026!")
        self.person = users.create_user(email="persona@example.com", password="StrongPass_2026!")
        self.client = APIClient()

    def test_metrics_are_aggregated_and_staff_only(self):
        self.client.force_authenticate(self.person)
        self.assertEqual(self.client.get("/api/ops/metrics/").status_code, 403)
        self.client.force_authenticate(self.staff)
        data = self.client.get("/api/ops/metrics/").json()
        for key in ("users_total", "reports_total", "reports_by_week", "reports_by_municipality",
                    "lost_with_suggestion", "median_days_to_return", "abuse_open", "feedback_open"):
            self.assertIn(key, data)
        self.assertEqual(data["users_total"], 2)
        self.assertNotIn("persona@example.com", str(data))

    def test_feedback_without_account_and_review(self):
        created = self.client.post("/api/feedback/", {"mood": "confused", "message": "No supe dónde ver mi caso",
                                                      "page": "/mi-espacio", "connection": "3g"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.post("/api/feedback/", {"mood": "x", "message": "hola"}, format="json").status_code, 400)
        self.client.force_authenticate(self.staff)
        queue = self.client.get("/api/ops/feedback/").json()
        self.assertEqual(queue[0]["connection"], "3g")
        self.assertEqual(self.client.post(f"/api/ops/feedback/{queue[0]['id']}/resolve/").status_code, 200)
        self.assertTrue(Feedback.objects.get().resolved)

    def test_client_errors_are_accepted_quietly(self):
        response = self.client.post("/api/client-errors/", {"message": "TypeError: x is undefined", "page": "/reportar"}, format="json")
        self.assertEqual(response.status_code, 204)
