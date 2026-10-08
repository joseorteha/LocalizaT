import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from reports.models import Report

from . import embeddings
from .models import MatchingJob, MatchSuggestion, ReportEmbedding
from .scoring import SUGGESTION_THRESHOLD, canonical_text, score_pair, score_pair_semantic


logger = logging.getLogger(__name__)


def report_vectors(reports):
    """Vector de cada reporte por id; calcula y guarda los que falten.

    Devuelve ``None`` si no hay modelo de lenguaje disponible.
    """
    model_name = settings.MATCHING_MODEL
    vectors = dict(ReportEmbedding.objects.filter(
        report__in=reports, model_name=model_name,
    ).values_list("report_id", "vector"))
    missing = [item for item in reports if item.pk not in vectors]
    if missing:
        computed = embeddings.embed(canonical_text(item.description) for item in missing)
        if computed is None:
            return None
        for item, vector in zip(missing, computed):
            ReportEmbedding.objects.update_or_create(report=item, defaults={"model_name": model_name, "vector": vector})
            vectors[item.pk] = vector
    return vectors


def pair_scorer(report, candidates):
    """La función de puntuación del motor configurado para este grupo de reportes."""
    if settings.MATCHING_ENGINE != "semantic":
        return score_pair
    vectors = report_vectors([report, *candidates])
    if vectors is None:
        logger.warning("Sin modelo de lenguaje: el reporte %s se compara con el motor de reglas.", report.folio)
        return score_pair
    return lambda lost, found: score_pair_semantic(lost, found, embeddings.cosine(vectors[lost.pk], vectors[found.pk]))


def process_report(report):
    if report.status != Report.Status.ACTIVE:
        return 0
    other_kind = Report.Kind.FOUND if report.kind == Report.Kind.LOST else Report.Kind.LOST
    candidates = list(Report.objects.filter(
        kind=other_kind,
        category=report.category,
        status=Report.Status.ACTIVE,
        occurred_on__gte=report.occurred_on - timedelta(days=14),
        occurred_on__lte=report.occurred_on + timedelta(days=14),
    ).exclude(owner_id=report.owner_id).order_by("-created_at")[:500])
    scorer = pair_scorer(report, candidates)
    created_count = 0
    for candidate in candidates:
        lost, found = (report, candidate) if report.kind == Report.Kind.LOST else (candidate, report)
        score, reasons = scorer(lost, found)
        if score < SUGGESTION_THRESHOLD:
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
