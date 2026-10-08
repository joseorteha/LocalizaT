import re
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from reports.models import Report

from .models import MatchingJob, MatchSuggestion


STOPWORDS = {"de", "del", "la", "el", "los", "las", "con", "una", "uno", "por", "para", "que", "en", "un"}
logger = logging.getLogger(__name__)


def words(value):
    return {part for part in re.findall(r"[\wáéíóúñ]+", value.casefold()) if len(part) > 2 and part not in STOPWORDS}


def score_pair(lost, found):
    if lost.kind != Report.Kind.LOST or found.kind != Report.Kind.FOUND:
        return 0, []
    if lost.category != found.category or lost.owner_id == found.owner_id:
        return 0, []
    days = abs((lost.occurred_on - found.occurred_on).days)
    if days > 14:
        return 0, []
    score = 40 + max(0, 20 - days * 2)
    reasons = ["misma categoría", "fechas próximas"]
    if words(lost.approximate_area) & words(found.approximate_area):
        score += 20
        reasons.append("zona relacionada")
    common = words(lost.description) & words(found.description)
    if common:
        score += min(20, len(common) * 5)
        reasons.append("rasgos similares")
    return min(score, 100), reasons


def process_report(report):
    if report.status != Report.Status.ACTIVE:
        return 0
    other_kind = Report.Kind.FOUND if report.kind == Report.Kind.LOST else Report.Kind.LOST
    candidates = Report.objects.filter(
        kind=other_kind,
        category=report.category,
        status=Report.Status.ACTIVE,
        occurred_on__gte=report.occurred_on - timedelta(days=14),
        occurred_on__lte=report.occurred_on + timedelta(days=14),
    ).exclude(owner_id=report.owner_id).order_by("-created_at")[:500]
    created_count = 0
    for candidate in candidates:
        lost, found = (report, candidate) if report.kind == Report.Kind.LOST else (candidate, report)
        score, reasons = score_pair(lost, found)
        if score < 55:
            continue
        suggestion, created = MatchSuggestion.objects.get_or_create(
            lost_report=lost, found_report=found,
            defaults={"score": score, "reasons": reasons},
        )
        if created:
            created_count += 1
            for owner, counterpart in ((lost.owner, found), (found.owner, lost)):
                if counterpart.publication_status == Report.Publication.PUBLIC:
                    Notification.objects.create(
                        recipient=owner,
                        kind=Notification.Kind.MATCH,
                        title="Posible coincidencia",
                        body="Hay un reporte público compatible para revisar. No confirma la propiedad.",
                        report=lost if owner.pk == lost.owner_id else found,
                    )
    return created_count


@transaction.atomic
def process_next_job():
    job = MatchingJob.objects.select_for_update(skip_locked=True).filter(
        status=MatchingJob.Status.QUEUED,
    ).select_related("report").order_by("created_at").first()
    if job is None:
        return False
    job.attempts += 1
    job.save(update_fields=["attempts"])
    try:
        with transaction.atomic():
            process_report(job.report)
    except Exception:
        logger.exception("Falló el procesamiento de coincidencias del trabajo %s", job.pk)
        job.status = MatchingJob.Status.FAILED if job.attempts >= 3 else MatchingJob.Status.QUEUED
    else:
        job.status = MatchingJob.Status.DONE
        job.processed_at = timezone.now()
    job.save(update_fields=["attempts", "status", "processed_at"])
    return True
