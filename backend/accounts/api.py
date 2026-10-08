import json

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
