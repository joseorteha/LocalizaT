from django.contrib import admin

from .models import CustodyEvent, CustodyPoint, CustodyRecord, Handover


@admin.register(CustodyPoint)
class CustodyPointAdmin(admin.ModelAdmin):
    list_display = ("name", "public_area", "active")
    list_filter = ("active",)
    filter_horizontal = ("members",)


@admin.register(CustodyRecord)
class CustodyRecordAdmin(admin.ModelAdmin):
    list_display = ("report", "current_point", "released_at", "updated_at")
    readonly_fields = ("report", "current_point", "released_at", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustodyEvent)
class CustodyEventAdmin(admin.ModelAdmin):
    list_display = ("report", "action", "point", "actor", "created_at")
    readonly_fields = ("report", "action", "point", "actor", "note", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Handover)
class HandoverAdmin(admin.ModelAdmin):
    list_display = ("report", "claim", "status", "initiated_by", "initiated_at", "confirmed_at")
    readonly_fields = ("report", "claim", "point", "initiated_by", "initiated_at", "note", "status", "confirmed_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
