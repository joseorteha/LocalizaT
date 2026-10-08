from datetime import date
import re

from django.db import transaction
from rest_framework import serializers

from .models import Report, ReportPrivate
from .geography import MUNICIPALITIES


class ReportSerializer(serializers.ModelSerializer):
    ownership_clue = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=500)
    client_request_id = serializers.UUIDField(write_only=True)
    match_count = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "folio", "kind", "category", "description", "approximate_area",
            "occurred_on", "holder", "status", "created_at", "client_request_id",
            "ownership_clue", "publication_status", "public_summary", "public_area", "publication_review_reason",
            "match_count",
        ]
        read_only_fields = ["id", "folio", "status", "created_at", "publication_status", "public_summary", "public_area", "publication_review_reason"]

    def get_match_count(self, obj):
        # Lo calcula reports.api.with_match_count; un reporte recién creado aún no tiene.
        return getattr(obj, "lost_matches", 0) + getattr(obj, "found_matches", 0)

    def validate_description(self, value):
        if len(value.strip()) < 12:
            raise serializers.ValidationError("Describe el objeto con al menos 12 caracteres.")
        return value.strip()

    def validate_approximate_area(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Indica una zona aproximada.")
        return value.strip()

    def validate_occurred_on(self, value):
        if value > date.today():
            raise serializers.ValidationError("La fecha no puede estar en el futuro.")
        return value

    def validate(self, attrs):
        kind = attrs.get("kind")
        clue = attrs.get("ownership_clue", "").strip()
        holder = attrs.get("holder", "")
        if kind == Report.Kind.LOST:
            if len(clue) < 6:
                raise serializers.ValidationError({"ownership_clue": "Escribe una pista privada de al menos seis caracteres."})
            if holder:
                raise serializers.ValidationError({"holder": "Una pérdida no tiene custodio."})
        elif kind == Report.Kind.FOUND:
            if clue:
                raise serializers.ValidationError({"ownership_clue": "La pista de propiedad corresponde al reporte de pérdida."})
            if holder not in ("", Report.Holder.FINDER):
                raise serializers.ValidationError({"holder": "Todavía no hay puntos de resguardo registrados."})
            attrs["holder"] = Report.Holder.FINDER
        attrs["ownership_clue"] = clue
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        clue = validated_data.pop("ownership_clue", "")
        report = Report.objects.create(**validated_data)
        ReportPrivate.objects.create(report=report, ownership_clue=clue)
        return report


class PublicReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "kind", "category", "public_summary", "public_area", "occurred_on", "published_at"]


class PublicationRequestSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["instant", "review"], default="review")
    municipality = serializers.ChoiceField(choices=list(MUNICIPALITIES), required=False)
    public_summary = serializers.CharField(min_length=12, max_length=160, trim_whitespace=True, required=False)
    public_area = serializers.CharField(min_length=3, max_length=80, trim_whitespace=True, required=False)

    def validate(self, attrs):
        if attrs["mode"] == "instant":
            if "public_summary" in attrs or "public_area" in attrs:
                raise serializers.ValidationError("El aviso inmediato usa únicamente texto y zona generados por el sistema.")
            return attrs
        if "municipality" in attrs:
            raise serializers.ValidationError({"municipality": "El municipio se elige solo para el aviso básico."})
        for field in ("public_summary", "public_area"):
            if field not in attrs:
                raise serializers.ValidationError({field: "Este campo es obligatorio para un aviso detallado."})
        for field, value in attrs.items():
            if field == "mode":
                continue
            if re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?://|\d{6,}", value, re.IGNORECASE):
                raise serializers.ValidationError({field: "No incluyas correo, enlaces, teléfonos ni números largos en un aviso público."})
        return attrs


class PublicationDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject", "hide"])
    reason = serializers.CharField(min_length=5, max_length=300)
