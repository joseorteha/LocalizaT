from django.contrib import admin

from .models import EmailDelivery, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "kind", "title", "created_at", "read_at")
    list_filter = ("kind",)
    search_fields = ("recipient__email", "title")


@admin.register(EmailDelivery)
class EmailDeliveryAdmin(admin.ModelAdmin):
    # Para revisar si un correo salió; el contenido no se muestra.
    list_display = ("id", "to_email", "kind", "status", "attempts", "created_at", "sent_at")
    list_filter = ("kind", "status")
    search_fields = ("to_email",)
    fields = ("recipient", "to_email", "kind", "subject", "status", "attempts", "next_attempt_at", "created_at", "sent_at")
    readonly_fields = fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
