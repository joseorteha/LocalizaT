from unittest.mock import patch
import base64

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Notification, PushDelivery, PushSubscription
from .push import process_next_push


@override_settings(VAPID_PRIVATE_KEY="test-private", VAPID_PUBLIC_KEY="test-public")
class PushTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="push@example.com", password="Password123!unique")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.endpoint = "https://fcm.googleapis.com/fcm/send/example"
        self.keys = {
            "p256dh": base64.urlsafe_b64encode(b"\x04" + b"a" * 64).rstrip(b"=").decode(),
            "auth": base64.urlsafe_b64encode(b"b" * 16).rstrip(b"=").decode(),
        }

    def test_opt_in_and_only_match_notifications_queue_push(self):
        saved = self.client.post("/api/push/subscriptions/", {
            "endpoint": self.endpoint, "keys": self.keys,
        }, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(self.client.get("/api/push/subscriptions/", {"endpoint": self.endpoint}).data["subscribed"])
        Notification.objects.create(recipient=self.user, kind=Notification.Kind.CLAIM, title="Solicitud", body="Revisa tu caso")
        self.assertEqual(PushDelivery.objects.count(), 0)
        Notification.objects.create(recipient=self.user, kind=Notification.Kind.MATCH, title="Posible coincidencia", body="Revisa tu caso")
        self.assertEqual(PushDelivery.objects.count(), 1)
        with patch("notifications.push.webpush") as send:
            self.assertTrue(process_next_push())
        self.assertEqual(PushDelivery.objects.get().status, PushDelivery.Status.SENT)
        self.assertNotIn(self.keys["auth"], send.call_args.kwargs["data"])
        self.assertEqual(self.client.delete("/api/push/subscriptions/", {"endpoint": self.endpoint}, format="json").status_code, 200)
        self.assertFalse(PushSubscription.objects.exists())

    def test_rejects_arbitrary_push_endpoint_and_other_users_cannot_unsubscribe(self):
        bad = self.client.post("/api/push/subscriptions/", {
            "endpoint": "https://127.0.0.1/private", "keys": self.keys,
        }, format="json")
        self.assertEqual(bad.status_code, 400)
        second = get_user_model().objects.create_user(email="second@example.com", password="Password123!unique")
        PushSubscription.objects.create(user=second, endpoint=self.endpoint, **self.keys)
        conflict = self.client.post("/api/push/subscriptions/", {"endpoint": self.endpoint, "keys": self.keys}, format="json")
        self.assertEqual(conflict.status_code, 409)
        self.client.delete("/api/push/subscriptions/", {"endpoint": self.endpoint}, format="json")
        self.assertTrue(PushSubscription.objects.filter(user=second).exists())
