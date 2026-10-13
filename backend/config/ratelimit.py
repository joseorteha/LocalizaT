"""Límites de intentos para las vistas de cuenta (login, registro, recuperar contraseña).

Las vistas de la API REST usan los throttles de DRF; estas vistas son funciones de
Django, así que llevan su propio contador en la caché compartida (settings.CACHES).
"""
import hashlib

from django.conf import settings
from django.core.cache import cache


def client_ip(request):
    """IP de la persona. Detrás de Caddy la real viene en X-Forwarded-For (igual que en DRF)."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    proxies = settings.NUM_PROXIES
    if proxies and forwarded:
        addresses = [address.strip() for address in forwarded.split(",") if address.strip()]
        if addresses:
            return addresses[-min(proxies, len(addresses))]
    return request.META.get("REMOTE_ADDR", "")


def _name(scope, key):
    # El correo no se guarda tal cual en la caché.
    digest = hashlib.sha256(str(key).lower().encode()).hexdigest()[:24]
    return f"rl:{scope}:{digest}"


def blocked(scope, key):
    limit, _window = settings.AUTH_RATE_LIMITS[scope]
    return (cache.get(_name(scope, key)) or 0) >= limit


def hit(scope, key):
    """Cuenta un intento y dice si con él ya se rebasó el límite."""
    limit, window = settings.AUTH_RATE_LIMITS[scope]
    name = _name(scope, key)
    cache.add(name, 0, window)
    try:
        count = cache.incr(name)
    except ValueError:  # expiró entre add e incr
        cache.set(name, 1, window)
        count = 1
    return count > limit


def clear(scope, key):
    cache.delete(_name(scope, key))
