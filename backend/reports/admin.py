from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("folio", "kind", "category", "approximate_area", "status", "publication_status", "created_at")
    list_filter = ("kind", "category", "status", "publication_status")
    search_fields = ("folio", "description", "approximate_area")
    readonly_fields = ("id", "folio", "client_request_id", "owner", "kind", "category", "description", "approximate_area", "occurred_on", "holder", "status", "publication_status", "public_summary", "public_area", "publication_review_reason", "published_at", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
