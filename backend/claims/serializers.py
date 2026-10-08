from rest_framework import serializers
from reports.serializers import PublicReportSerializer

from .models import Claim


class ClaimCreateSerializer(serializers.Serializer):
    found_report_id = serializers.UUIDField()
    lost_report_id = serializers.UUIDField(required=False, allow_null=True)
    evidence = serializers.CharField(min_length=15, max_length=1000, trim_whitespace=True)


class ClaimDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject", "dispute"])
    reason = serializers.CharField(min_length=8, max_length=500)


class ClaimContextMixin:
    def get_handover(self, obj):
        if not hasattr(obj, "handover"):
            return None
        return {"id": obj.handover.pk, "status": obj.handover.status, "confirmed_at": obj.handover.confirmed_at}


class ClaimSerializer(ClaimContextMixin, serializers.ModelSerializer):
    found_summary = PublicReportSerializer(source="found_report", read_only=True)
    handover = serializers.SerializerMethodField()
    class Meta:
        model = Claim
        fields = ["id", "found_report", "lost_report", "claimant", "evidence", "status", "created_at", "decided_at", "decision_reason", "found_summary", "handover"]


class ClaimListSerializer(ClaimContextMixin, serializers.ModelSerializer):
    found_summary = PublicReportSerializer(source="found_report", read_only=True)
    handover = serializers.SerializerMethodField()
    class Meta:
        model = Claim
        fields = ["id", "found_report", "lost_report", "claimant", "status", "created_at", "decided_at", "found_summary", "handover"]
