from django.contrib import admin

from .models import AuditEvent, Feedback


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "object_type", "object_id", "actor")
    list_filter = ("action", "object_type")
    search_fields = ("object_id", "actor__email")
    readonly_fields = ("actor", "action", "object_type", "object_id", "detail", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("created_at", "mood", "page", "connection", "resolved")
    list_filter = ("mood", "resolved", "connection")
    search_fields = ("message", "page")
    readonly_fields = ("user", "mood", "message", "page", "device", "connection", "created_at")
