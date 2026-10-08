from django.conf import settings
from django.db import models
from django.db.models import Q

from reports.models import Report


class Claim(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Enviada"
        DISPUTED = "disputed", "En disputa"
        APPROVED = "approved", "Aprobada"
        REJECTED = "rejected", "Rechazada"

    found_report = models.ForeignKey(Report, on_delete=models.PROTECT, related_name="claims")
    lost_report = models.ForeignKey(Report, null=True, blank=True, on_delete=models.PROTECT, related_name="claims_from_loss")
    claimant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="claims")
    evidence = models.TextField(max_length=1000)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decided_claims")
    decision_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["found_report", "claimant"], name="one_claim_per_user_and_found"),
            models.UniqueConstraint(fields=["found_report"], condition=Q(status="approved"), name="one_approved_claim_per_found"),
        ]
        indexes = [models.Index(fields=["status", "created_at"], name="claim_review_idx")]
