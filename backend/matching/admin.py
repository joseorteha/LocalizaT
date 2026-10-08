from django.contrib import admin

from .models import MatchSuggestion, MatchingJob


@admin.register(MatchSuggestion)
class MatchSuggestionAdmin(admin.ModelAdmin):
    list_display = ("id", "lost_report", "found_report", "score", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("lost_report__folio", "found_report__folio")


@admin.register(MatchingJob)
class MatchingJobAdmin(admin.ModelAdmin):
    list_display = ("report", "status", "attempts", "created_at", "processed_at")
    list_filter = ("status",)
