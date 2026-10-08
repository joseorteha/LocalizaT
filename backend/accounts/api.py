import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.core.validators import validate_email

from .models import User


def read_json(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def identity(user):
    return {"id": user.pk, "email": user.email, "is_staff": user.is_staff,
            "is_point_member": user.custody_points.filter(active=True).exists(),
            "point_ids": list(user.custody_points.filter(active=True).values_list("id", flat=True))}


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
@csrf_protect
def signup(request):
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    try:
        validate_email(email)
        validate_password(password)
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)
    try:
        user = User.objects.create_user(email=email, password=password)
    except IntegrityError:
        return JsonResponse({"error": "Ese correo ya está registrado."}, status=409)
    login(request, user)
    return JsonResponse({"user": identity(user)}, status=201)


@require_POST
@csrf_protect
def login_view(request):
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse({"error": "Correo o contraseña incorrectos."}, status=401)
    login(request, user)
    return JsonResponse({"user": identity(user)})


@require_POST
@csrf_protect
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"user": None})
    return JsonResponse({"user": identity(request.user)})


@require_GET
def auth_config(request):
    """Datos públicos que el frontend necesita (ID de cliente de Google, si lo hay)."""
    return JsonResponse({"google_client_id": settings.GOOGLE_OAUTH_CLIENT_ID})


@require_POST
@csrf_protect
def google_login(request):
    """Inicia sesión con un token de identidad de Google (botón "Continuar con Google")."""
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        return JsonResponse({"error": "El inicio con Google no está disponible."}, status=503)
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    credential = str(data.get("credential", ""))
    if not credential:
        return JsonResponse({"error": "Falta el token de Google."}, status=400)
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_OAUTH_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except Exception:
        return JsonResponse({"error": "No se pudo verificar tu cuenta de Google."}, status=401)
    if not info.get("email") or not info.get("email_verified"):
        return JsonResponse({"error": "Tu correo de Google no está verificado."}, status=401)
    email = str(info["email"]).strip().lower()
    user, created = User.objects.get_or_create(email=email)
    if created:
        user.set_unusable_password()
        user.first_name = str(info.get("given_name", ""))[:150]
        user.last_name = str(info.get("family_name", ""))[:150]
        user.save()
    # Hay un solo backend de autenticación; lo indicamos explícitamente porque no
    # pasamos por authenticate().
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return JsonResponse({"user": identity(user)}, status=201 if created else 200)
