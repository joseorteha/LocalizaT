import re

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from notifications.models import EmailDelivery


def link_params(delivery):
    match = re.search(r"uid=([\w-]+)&token=([\w-]+)", delivery.text_body)
    return match.group(1), match.group(2)


class AccountSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(email="ana@example.com", password="StrongPass_2026!")

    def test_signup_sends_verification_and_link_verifies_once(self):
        response = self.client.post("/api/auth/signup/", {"email": "nuevo@example.com", "password": "OtraClave_2026!"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()["user"]["email_verified"])
        delivery = EmailDelivery.objects.get(to_email="nuevo@example.com", kind=EmailDelivery.Kind.VERIFY)
        uid, token = link_params(delivery)
        verified = self.client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")
        self.assertEqual(verified.status_code, 200)
        self.assertTrue(get_user_model().objects.get(email="nuevo@example.com").email_verified)
        # El mismo enlace ya no cambia nada, pero tampoco asusta a quien lo vuelve a abrir.
        again = self.client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")
        self.assertEqual(again.json().get("already"), True)

    def test_bad_verification_token_is_rejected(self):
        self.client.post("/api/auth/signup/", {"email": "otro@example.com", "password": "OtraClave_2026!"}, format="json")
        delivery = EmailDelivery.objects.get(to_email="otro@example.com")
        uid, _token = link_params(delivery)
        response = self.client.post("/api/auth/verify-email/", {"uid": uid, "token": "x-y"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_login_is_blocked_after_repeated_failures_for_the_same_email(self):
        for _ in range(6):
            response = self.client.post("/api/auth/login/", {"email": "ana@example.com", "password": "mala"}, format="json")
            self.assertEqual(response.status_code, 401)
        blocked = self.client.post("/api/auth/login/", {"email": "ana@example.com", "password": "StrongPass_2026!"}, format="json")
        self.assertEqual(blocked.status_code, 429)

    def test_signup_is_rate_limited_per_ip(self):
        statuses = [
            self.client.post("/api/auth/signup/", {"email": f"p{i}@example.com", "password": "OtraClave_2026!"}, format="json").status_code
            for i in range(9)
        ]
        self.assertEqual(statuses[:8], [201] * 8)
        self.assertEqual(statuses[8], 429)

    def test_password_reset_does_not_reveal_accounts(self):
        unknown = self.client.post("/api/auth/password-reset/", {"email": "nadie@example.com"}, format="json")
        known = self.client.post("/api/auth/password-reset/", {"email": "ana@example.com"}, format="json")
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.json(), known.json())
        self.assertEqual(EmailDelivery.objects.filter(kind=EmailDelivery.Kind.RESET).count(), 1)

    def test_password_reset_link_changes_password_once(self):
        self.client.post("/api/auth/password-reset/", {"email": "ana@example.com"}, format="json")
        uid, token = link_params(EmailDelivery.objects.get(kind=EmailDelivery.Kind.RESET))
        changed = self.client.post("/api/auth/password-reset/confirm/",
                                   {"uid": uid, "token": token, "password": "NuevaClave_2026!"}, format="json")
        self.assertEqual(changed.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NuevaClave_2026!"))
        self.assertTrue(self.user.email_verified)
        reused = self.client.post("/api/auth/password-reset/confirm/",
                                  {"uid": uid, "token": token, "password": "OtraMas_2026!"}, format="json")
        self.assertEqual(reused.status_code, 400)

    def test_weak_password_is_rejected_on_reset(self):
        self.client.post("/api/auth/password-reset/", {"email": "ana@example.com"}, format="json")
        uid, token = link_params(EmailDelivery.objects.get(kind=EmailDelivery.Kind.RESET))
        response = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "123"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_email_preferences_require_session_and_boolean(self):
        anonymous = self.client.post("/api/auth/preferences/", {"email_notifications": False}, format="json")
        self.assertEqual(anonymous.status_code, 401)
        self.client.force_login(self.user)
        wrong = self.client.post("/api/auth/preferences/", {"email_notifications": "no"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        ok = self.client.post("/api/auth/preferences/", {"email_notifications": False}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_notifications)

    def test_change_password_checks_current_one(self):
        self.client.force_login(self.user)
        wrong = self.client.post("/api/auth/password/", {"current": "mala", "password": "NuevaClave_2026!"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        ok = self.client.post("/api/auth/password/", {"current": "StrongPass_2026!", "password": "NuevaClave_2026!"}, format="json")
        self.assertEqual(ok.status_code, 200)
        # La sesión sigue abierta tras cambiarla.
        self.assertEqual(self.client.get("/api/auth/me/").json()["user"]["email"], "ana@example.com")
