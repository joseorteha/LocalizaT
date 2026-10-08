from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    object_type = models.CharField(max_length=50)
    object_id = models.CharField(max_length=40)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["object_type", "object_id", "created_at"], name="audit_object_idx")]


def record(*, actor, action, obj, detail=None):
    return AuditEvent.objects.create(
        actor=actor,
        action=action,
        object_type=obj._meta.label_lower,
        object_id=str(obj.pk),
        detail=detail or {},
    )
