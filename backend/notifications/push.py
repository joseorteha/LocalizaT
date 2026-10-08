import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pywebpush import WebPushException, webpush

from .models import PushDelivery


def process_next_push():
    if not (settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY):
        return False
    now = timezone.now()
    with transaction.atomic():
        delivery = (PushDelivery.objects.select_for_update(skip_locked=True)
                    .filter(status__in=[PushDelivery.Status.PENDING, PushDelivery.Status.SENDING],
                            next_attempt_at__lte=now)
                    .select_related("subscription", "notification")
                    .order_by("next_attempt_at", "pk").first())
        if not delivery:
            return False
        delivery.status = PushDelivery.Status.SENDING
        delivery.attempts += 1
        delivery.next_attempt_at = now + timedelta(minutes=2)
        delivery.save(update_fields=["status", "attempts", "next_attempt_at"])
    try:
        webpush(
            subscription_info={"endpoint": delivery.subscription.endpoint,
                               "keys": {"p256dh": delivery.subscription.p256dh, "auth": delivery.subscription.auth}},
            data=json.dumps({"title": "Posible coincidencia en LocalizaT",
                             "body": "Hay un aviso compatible con tu reporte. Revísalo en tu espacio.",
                             "url": "/mi-espacio?section=alerts"}),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=3600,
            timeout=5,
        )
    except WebPushException as error:
        response = getattr(error, "response", None)
        if response is not None and response.status_code in (404, 410):
            delivery.subscription.delete()
            return True
        delivery.status = PushDelivery.Status.FAILED if delivery.attempts >= 3 else PushDelivery.Status.PENDING
    except Exception:
        delivery.status = PushDelivery.Status.FAILED if delivery.attempts >= 3 else PushDelivery.Status.PENDING
    else:
        delivery.status = PushDelivery.Status.SENT
    if delivery.status == PushDelivery.Status.PENDING:
        delivery.next_attempt_at = timezone.now() + timedelta(minutes=2 ** delivery.attempts)
    delivery.save(update_fields=["status", "next_attempt_at"])
    return True
