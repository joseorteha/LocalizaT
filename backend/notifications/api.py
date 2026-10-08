from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from urllib.parse import urlsplit
import base64
import binascii
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, PushSubscription


def valid_push_endpoint(value):
    if not isinstance(value, str) or len(value) > 2048:
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return (
        parsed.scheme == "https" and not parsed.username and not parsed.password
        and port in (None, 443) and bool(parsed.path)
        and (host == "fcm.googleapis.com"
             or host == "updates.push.services.mozilla.com"
             or host.endswith(".push.apple.com")
             or host.endswith(".notify.windows.com"))
    )


class PushConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"enabled": bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY),
                         "public_key": settings.VAPID_PUBLIC_KEY if settings.VAPID_PRIVATE_KEY else ""})


class PushSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        endpoint = request.query_params.get("endpoint", "")
        return Response({"subscribed": PushSubscription.objects.filter(user=request.user, endpoint=endpoint).exists()})

    def post(self, request):
        if not (settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY):
            return Response({"error": "Las notificaciones push no están configuradas."}, status=503)
        endpoint = request.data.get("endpoint")
        keys = request.data.get("keys")
        if not valid_push_endpoint(endpoint) or not isinstance(keys, dict):
            return Response({"error": "Suscripción push inválida."}, status=400)
        p256dh, auth = keys.get("p256dh"), keys.get("auth")
        if not all(isinstance(key, str) and 8 <= len(key) <= 256 for key in (p256dh, auth)):
            return Response({"error": "Claves push inválidas."}, status=400)
        try:
            public_bytes = base64.urlsafe_b64decode(p256dh + "=" * (-len(p256dh) % 4))
            auth_bytes = base64.urlsafe_b64decode(auth + "=" * (-len(auth) % 4))
        except (binascii.Error, ValueError):
            return Response({"error": "Claves push inválidas."}, status=400)
        if len(public_bytes) != 65 or public_bytes[0] != 4 or len(auth_bytes) != 16:
            return Response({"error": "Claves push inválidas."}, status=400)
        existing = PushSubscription.objects.filter(endpoint=endpoint).first()
        if existing and existing.user_id != request.user.pk:
            return Response({"error": "Este dispositivo ya pertenece a otra sesión. Desactiva sus avisos antes de activar los tuyos."}, status=409)
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=endpoint, defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
        )
        return Response({"subscribed": True, "id": subscription.pk})

    def delete(self, request):
        endpoint = request.data.get("endpoint")
        if not isinstance(endpoint, str):
            return Response({"error": "Falta el endpoint."}, status=400)
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({"subscribed": False})


class InboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user).order_by("-created_at")[:50]
        return Response([{
            "id": item.pk,
            "kind": item.kind,
            "title": item.title,
            "body": item.body,
            "report_id": item.report_id,
            "created_at": item.created_at,
            "read_at": item.read_at,
        } for item in notifications])


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        item = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if item.read_at is None:
            item.read_at = timezone.now()
            item.save(update_fields=["read_at"])
        return Response({"read_at": item.read_at})
