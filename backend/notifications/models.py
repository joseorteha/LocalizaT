from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        MATCH = "match", "Posible coincidencia"
        CLAIM = "claim", "Reclamación"
        PUBLICATION = "publication", "Publicación"
        HANDOVER = "handover", "Entrega"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=100)
    body = models.CharField(max_length=240)
    report = models.ForeignKey("reports.Report", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "read_at", "created_at"], name="notification_inbox_idx")]


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=2048, unique=True)
    p256dh = models.CharField(max_length=256)
    auth = models.CharField(max_length=256)
    created_at = models.DateTimeField(auto_now_add=True)


class PushDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        SENDING = "sending", "En proceso"
        SENT = "sent", "Enviado"
        FAILED = "failed", "Fallido"

    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="push_deliveries")
    subscription = models.ForeignKey(PushSubscription, on_delete=models.CASCADE, related_name="deliveries")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["notification", "subscription"], name="unique_push_delivery")]
        indexes = [models.Index(fields=["status", "next_attempt_at"], name="push_queue_idx")]
