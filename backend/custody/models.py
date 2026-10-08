from django.conf import settings
from django.db import models

from claims.models import Claim
from reports.models import Report


class CustodyPoint(models.Model):
    name = models.CharField(max_length=120)
    public_area = models.CharField(max_length=80)
    active = models.BooleanField(default=False)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="custody_points")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustodyRecord(models.Model):
    report = models.OneToOneField(Report, on_delete=models.PROTECT, related_name="custody_record")
    current_point = models.ForeignKey(CustodyPoint, on_delete=models.PROTECT)
    released_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class CustodyEvent(models.Model):
    class Action(models.TextChoices):
        INTAKE = "intake", "Recepción"
        TRANSFER = "transfer", "Traslado"
        HANDOVER_STARTED = "handover_started", "Entrega iniciada"
        HANDOVER_CONFIRMED = "handover_confirmed", "Entrega confirmada"

    report = models.ForeignKey(Report, on_delete=models.PROTECT, related_name="custody_events")
    point = models.ForeignKey(CustodyPoint, null=True, blank=True, on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=24, choices=Action.choices)
    note = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Handover(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de confirmación"
        CONFIRMED = "confirmed", "Confirmada por reclamante"

    report = models.OneToOneField(Report, on_delete=models.PROTECT, related_name="handover")
    claim = models.OneToOneField(Claim, on_delete=models.PROTECT, related_name="handover")
    point = models.ForeignKey(CustodyPoint, null=True, blank=True, on_delete=models.PROTECT)
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="initiated_handovers")
    initiated_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=500)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-initiated_at"]
