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


class Feedback(models.Model):
    """Comentario que deja una persona desde la app («¿Algo no se entendió?»)."""

    class Mood(models.TextChoices):
        CONFUSED = "confused", "No entendí algo"
        BROKEN = "broken", "Algo no funcionó"
        IDEA = "idea", "Tengo una idea"
        PRAISE = "praise", "Me gustó"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    mood = models.CharField(max_length=12, choices=Mood.choices)
    message = models.CharField(max_length=600)
    page = models.CharField(max_length=120, blank=True)
    # Datos para reproducir problemas en celulares de la Sierra (sin IP ni ubicación).
    device = models.CharField(max_length=200, blank=True)
    connection = models.CharField(max_length=20, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


def record(*, actor, action, obj, detail=None):
    return AuditEvent.objects.create(
        actor=actor,
        action=action,
        object_type=obj._meta.label_lower,
        object_id=str(obj.pk),
        detail=detail or {},
    )
