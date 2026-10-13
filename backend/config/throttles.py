from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle


class WriteScopedThrottle(ScopedRateThrottle):
    """Como ScopedRateThrottle, pero solo cuenta lo que crea o cambia algo: leer no gasta el límite."""

    def allow_request(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return super().allow_request(request, view)


# Para vistas que mezclan lectura y escritura con un límite propio de escritura.
WRITE_LIMITED = [AnonRateThrottle, UserRateThrottle, WriteScopedThrottle]
