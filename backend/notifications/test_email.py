from django.contrib.auth import get_user_model
from django.core import mail as outbox
from django.test import TestCase, override_settings

from notifications.mail import process_next_email
from notifications.models import EmailDelivery, Notification


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", SITE_URL="https://localizat.test")
class EmailNotificationTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.verified = users.create_user(email="si@example.com", password="StrongPass_2026!", email_verified=True)
        self.unverified = users.create_user(email="no@example.com", password="StrongPass_2026!")

    def notify(self, user, kind=Notification.Kind.MATCH):
        return Notification.objects.create(recipient=user, kind=kind, title="Posible coincidencia", body="Revísalo.")

    def test_only_verified_addresses_get_notification_emails(self):
        self.notify(self.verified)
        self.notify(self.unverified)
        self.assertEqual(list(EmailDelivery.objects.values_list("to_email", flat=True)), ["si@example.com"])

    def test_people_can_turn_emails_off(self):
        self.verified.email_notifications = False
        self.verified.save()
        self.notify(self.verified)
        self.assertFalse(EmailDelivery.objects.exists())

    def test_several_matches_in_half_an_hour_send_one_email(self):
        self.notify(self.verified)
        self.notify(self.verified)
        self.notify(self.verified, kind=Notification.Kind.CLAIM)  # otros avisos sí llegan
        self.assertEqual(EmailDelivery.objects.filter(kind="match").count(), 1)
        self.assertEqual(EmailDelivery.objects.filter(kind="claim").count(), 1)

    def test_worker_sends_and_marks_email(self):
        self.notify(self.verified)
        self.assertTrue(process_next_email())
        self.assertFalse(process_next_email())
        self.assertEqual(len(outbox.outbox), 1)
        message = outbox.outbox[0]
        self.assertEqual(message.to, ["si@example.com"])
        self.assertIn("https://localizat.test/mi-espacio", message.body)
        self.assertEqual(message.alternatives[0][1], "text/html")
        self.assertEqual(EmailDelivery.objects.get().status, EmailDelivery.Status.SENT)

    def test_one_time_links_are_erased_after_sending(self):
        from notifications.mail import queue_password_reset

        queue_password_reset(self.verified, "https://localizat.test/restablecer?uid=a&token=b")
        process_next_email()
        delivery = EmailDelivery.objects.get()
        self.assertEqual((delivery.text_body, delivery.html_body), ("", ""))
        self.assertIn("token=b", outbox.outbox[0].body)

    @override_settings(EMAIL_BACKEND="notifications.test_email.BrokenBackend")
    def test_failed_sends_are_retried_later(self):
        self.notify(self.verified)
        process_next_email()
        delivery = EmailDelivery.objects.get()
        self.assertEqual(delivery.status, EmailDelivery.Status.PENDING)
        self.assertEqual(delivery.attempts, 1)
        self.assertFalse(process_next_email())  # espera antes de reintentar


class BrokenBackend:
    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise ConnectionError("SMTP caído")
