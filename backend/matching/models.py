from django.db import models

from reports.models import Report


class MatchingJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "En espera"
        DONE = "done", "Procesado"
        FAILED = "failed", "Falló"

    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name="matching_job")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)


class MatchSuggestion(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        DISMISSED = "dismissed", "Descartada"

    lost_report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="lost_suggestions")
    found_report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="found_suggestions")
    score = models.PositiveSmallIntegerField()
    reasons = models.JSONField(default=list)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["lost_report", "found_report"], name="one_suggestion_per_pair")]
        indexes = [models.Index(fields=["status", "score"], name="suggestion_review_idx")]
