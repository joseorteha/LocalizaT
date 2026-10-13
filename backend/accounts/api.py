import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from config import ratelimit
from notifications import mail

from .models import User

TOO_MANY = "Hiciste demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo."


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """El enlace deja de servir en cuanto el correo queda verificado."""

    key_salt = "localizat.accounts.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.email_verified}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()


def read_json(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def identity(user):
    return {"id": user.pk, "email": user.email, "is_staff": user.is_staff,
            "email_verified": user.email_verified,
            "email_notifications": user.email_notifications,
            "has_password": user.has_usable_password(),
            "is_point_member": user.custody_points.filter(active=True).exists(),
            "point_ids": list(user.custody_points.filter(active=True).values_list("id", flat=True))}


def user_from_uid(uid):
    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(str(uid))))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def send_verification(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    mail.queue_verification(user, mail.site_link(f"/verificar?uid={uid}&token={token}"))


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
@csrf_protect
def signup(request):
    ip = ratelimit.client_ip(request)
    if ratelimit.hit("signup_ip", ip):
        return JsonResponse({"error": TOO_MANY}, status=429)
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    try:
        validate_email(email)
        validate_password(password, User(email=email))
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)
    try:
        user = User.objects.create_user(email=email, password=password)
    except IntegrityError:
        return JsonResponse({"error": "Ese correo ya está registrado. Entra o recupera tu contraseña."}, status=409)
    send_verification(user)
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
    ip = ratelimit.client_ip(request)
    if ratelimit.blocked("login_ip", ip) or ratelimit.blocked("login_email", email):
        return JsonResponse({"error": TOO_MANY}, status=429)
    user = authenticate(request, username=email, password=password)
    if user is None:
        ratelimit.hit("login_ip", ip)
        ratelimit.hit("login_email", email)
        return JsonResponse({"error": "Correo o contraseña incorrectos."}, status=401)
    ratelimit.clear("login_email", email)
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
    if ratelimit.hit("google_ip", ratelimit.client_ip(request)):
        return JsonResponse({"error": TOO_MANY}, status=429)
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
    # Google ya comprobó que el correo es de esta persona.
    user.email_verified = True
    user.save()
    # Hay un solo backend de autenticación; lo indicamos explícitamente porque no
    # pasamos por authenticate().
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return JsonResponse({"user": identity(user)}, status=201 if created else 200)


@require_POST
@csrf_protect
def password_reset(request):
    """Manda un enlace para elegir otra contraseña. Responde igual exista o no la cuenta."""
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    email = str(data.get("email", "")).strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Escribe un correo válido."}, status=400)
    if ratelimit.hit("reset_ip", ratelimit.client_ip(request)) or ratelimit.hit("reset_email", email):
        return JsonResponse({"error": TOO_MANY}, status=429)
    user = User.objects.filter(email=email, is_active=True).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        mail.queue_password_reset(user, mail.site_link(f"/restablecer?uid={uid}&token={token}"))
    return JsonResponse({"ok": True})


@require_POST
@csrf_protect
def password_reset_confirm(request):
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    if ratelimit.hit("reset_ip", ratelimit.client_ip(request)):
        return JsonResponse({"error": TOO_MANY}, status=429)
    user = user_from_uid(data.get("uid", ""))
    if user is None or not default_token_generator.check_token(user, str(data.get("token", ""))):
        return JsonResponse({"error": "El enlace ya no es válido. Pide uno nuevo desde «¿Olvidaste tu contraseña?»."}, status=400)
    password = str(data.get("password", ""))
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)
    user.set_password(password)
    # Quien recibió el enlace en su correo demostró que el correo es suyo.
    user.email_verified = True
    user.save(update_fields=["password", "email_verified"])
    ratelimit.clear("login_email", user.email)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return JsonResponse({"user": identity(user)})


@require_POST
@csrf_protect
def verify_email(request):
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    user = user_from_uid(data.get("uid", ""))
    if user is not None and user.email_verified:
        return JsonResponse({"ok": True, "already": True})
    if user is None or not email_verification_token.check_token(user, str(data.get("token", ""))):
        return JsonResponse({"error": "El enlace ya no es válido. Entra a tu cuenta y pide otro correo de confirmación."}, status=400)
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    return JsonResponse({"ok": True})


@require_POST
@csrf_protect
def resend_verification(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Entra a tu cuenta para pedir el correo."}, status=401)
    if request.user.email_verified:
        return JsonResponse({"ok": True, "already": True})
    if ratelimit.hit("verify_resend", request.user.pk):
        return JsonResponse({"error": TOO_MANY}, status=429)
    send_verification(request.user)
    return JsonResponse({"ok": True})


@require_http_methods(["POST"])
@csrf_protect
def preferences(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Entra a tu cuenta."}, status=401)
    data = read_json(request)
    if data is None or not isinstance(data.get("email_notifications"), bool):
        return JsonResponse({"error": "Indica si quieres recibir avisos por correo."}, status=400)
    request.user.email_notifications = data["email_notifications"]
    request.user.save(update_fields=["email_notifications"])
    return JsonResponse({"user": identity(request.user)})


@require_POST
@csrf_protect
def change_password(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Entra a tu cuenta."}, status=401)
    data = read_json(request)
    if data is None:
        return JsonResponse({"error": "Envía un objeto JSON válido."}, status=400)
    user = request.user
    if user.has_usable_password() and not user.check_password(str(data.get("current", ""))):
        if ratelimit.hit("login_email", user.email):
            return JsonResponse({"error": TOO_MANY}, status=429)
        return JsonResponse({"error": "Tu contraseña actual no coincide."}, status=400)
    password = str(data.get("password", ""))
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)
    user.set_password(password)
    user.save(update_fields=["password"])
    update_session_auth_hash(request, user)
    return JsonResponse({"user": identity(user)})
