from django.contrib import admin

from .models import Claim


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ("id", "found_report", "claimant", "status", "created_at", "decided_by")
    list_filter = ("status",)
    search_fields = ("found_report__folio", "claimant__email")
    readonly_fields = ("found_report", "lost_report", "claimant", "evidence", "status", "created_at", "decided_at", "decided_by", "decision_reason")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
