from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification, PushDelivery, PushSubscription


@receiver(post_save, sender=Notification)
def queue_match_push(sender, instance, created, **kwargs):
    if not created or instance.kind != Notification.Kind.MATCH:
        return
    subscriptions = PushSubscription.objects.filter(user_id=instance.recipient_id)
    PushDelivery.objects.bulk_create(
        [PushDelivery(notification=instance, subscription=subscription) for subscription in subscriptions],
        ignore_conflicts=True,
    )
