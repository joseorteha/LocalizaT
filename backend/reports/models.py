import uuid

from django.conf import settings
from django.db import models


def new_folio():
    return "LT-" + uuid.uuid4().hex[:12].upper()


class Report(models.Model):
    class Kind(models.TextChoices):
        LOST = "lost", "Perdí algo"
        FOUND = "found", "Encontré algo"

    class Category(models.TextChoices):
        BAG = "bag", "Bolsa o mochila"
        CLOTHING = "clothing", "Ropa"
        ACCESSORY = "accessory", "Accesorio"
        BOOK = "book", "Libro o cuaderno"
        PHONE = "phone", "Celular"
        CREDENTIAL = "credential", "Credencial o identificación"
        DOCUMENT = "document", "Documento"
        OTHER = "other", "Otro objeto"

    class Holder(models.TextChoices):
        FINDER = "finder", "Lo conserva quien lo encontró"
        POINT = "point", "Punto de resguardo"

    class Status(models.TextChoices):
        ACTIVE = "active", "Activo"
        RESERVED = "reserved", "Reclamación aprobada"
        RETURNED = "returned", "Entrega registrada"
        CLOSED = "closed", "Cerrado"

    class Publication(models.TextChoices):
        PRIVATE = "private", "Privado"
        PENDING = "pending", "Pendiente de revisión"
        PUBLIC = "public", "Publicado"
        REJECTED = "rejected", "Rechazado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folio = models.CharField(max_length=15, unique=True, default=new_folio, editable=False)
    client_request_id = models.UUIDField()
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports")
    kind = models.CharField(max_length=5, choices=Kind.choices)
    category = models.CharField(max_length=16, choices=Category.choices)
    description = models.CharField(max_length=300)
    approximate_area = models.CharField(max_length=120)
    occurred_on = models.DateField()
    holder = models.CharField(max_length=16, choices=Holder.choices, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    publication_status = models.CharField(max_length=16, choices=Publication.choices, default=Publication.PRIVATE)
    public_summary = models.CharField(max_length=160, blank=True)
    public_area = models.CharField(max_length=80, blank=True)
    publication_review_reason = models.CharField(max_length=300, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "client_request_id"], name="unique_report_request_per_owner"),
        ]
        indexes = [
            models.Index(fields=["publication_status", "status", "kind", "category", "occurred_on"], name="report_public_search_idx"),
            models.Index(fields=["status", "kind", "category", "occurred_on"], name="report_matching_idx"),
        ]

    def __str__(self):
        return self.folio


class ReportPrivate(models.Model):
    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name="private")
    ownership_clue = models.TextField(blank=True)

    def __str__(self):
        return f"Datos privados de {self.report.folio}"
