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


class EmailDelivery(models.Model):
    """Un correo por enviar. El worker los manda en orden y reintenta si el servidor de correo falla."""

    class Kind(models.TextChoices):
        MATCH = "match", "Posible coincidencia"
        CLAIM = "claim", "Reclamación"
        PUBLICATION = "publication", "Publicación"
        HANDOVER = "handover", "Entrega"
        VERIFY = "verify", "Verificar correo"
        RESET = "reset", "Recuperar contraseña"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        SENDING = "sending", "En proceso"
        SENT = "sent", "Enviado"
        FAILED = "failed", "Fallido"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_deliveries")
    notification = models.ForeignKey(Notification, null=True, blank=True, on_delete=models.SET_NULL, related_name="email_deliveries")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    to_email = models.EmailField()
    subject = models.CharField(max_length=150)
    # El cuerpo se borra al enviarse cuando lleva un enlace de un solo uso.
    text_body = models.TextField(blank=True)
    html_body = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "next_attempt_at"], name="email_queue_idx")]
