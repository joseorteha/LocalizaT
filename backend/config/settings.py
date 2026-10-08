import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if os.environ.get("TEST_DB_ENGINE") == "sqlite":
        SECRET_KEY = "localizat-tests-only-secret-key"
    else:
        raise ImproperlyConfigured("Configura DJANGO_SECRET_KEY antes de iniciar Django.")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "reports",
    "matching",
    "claims",
    "custody",
    "notifications",
    "audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Sirve los estáticos del panel /admin en producción (comprimidos, sin un
    # servidor web aparte). En desarrollo no estorba.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

WSGI_APPLICATION = "config.wsgi.application"
AUTH_USER_MODEL = "accounts.User"

if os.environ.get("TEST_DB_ENGINE") == "sqlite":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "test-local.sqlite3"}}
elif os.environ.get("DATABASE_URL"):
    # Los servicios administrados (Neon, etc.) entregan la conexión en una sola
    # variable DATABASE_URL. La partimos en los campos que pide Django y pasamos
    # sslmode/channel_binding tal como vienen en la cadena de Neon.
    import urllib.parse as _urlparse

    _url = _urlparse.urlparse(os.environ["DATABASE_URL"])
    _query = _urlparse.parse_qs(_url.query)
    _options = {key: _query[key][0] for key in ("sslmode", "channel_binding") if key in _query}
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _url.path.lstrip("/"),
        "USER": _urlparse.unquote(_url.username or ""),
        "PASSWORD": _urlparse.unquote(_url.password or ""),
        "HOST": _url.hostname or "",
        "PORT": str(_url.port or ""),
        "OPTIONS": _options,
        "CONN_MAX_AGE": 0,
    }}
else:
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "localizat"),
        "USER": os.environ.get("POSTGRES_USER", "localizat"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mexico_City"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # WhiteNoise comprime los estáticos; sin manifiesto para no romper /admin en desarrollo.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# En producción el tráfico llega por HTTPS a través de un proxy (Caddy, y antes
# Vercel). Django confía en la cabecera que pone el proxy para saber que la
# conexión original fue segura. Caddy ya obliga HTTPS, así que no redirigimos
# aquí (evita bucles detrás del proxy).
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
# Inicio de sesión con Google (botón "Continuar con Google"). El ID de cliente
# es público; si está vacío, el botón simplemente no aparece.
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@localizat.example")

# Coincidencias: "rules" (palabras exactas) o "semantic" (palabras normalizadas
# más un modelo de lenguaje local). Comparar ambos con `manage.py evaluate_matching`.
MATCHING_ENGINE = os.environ.get("MATCHING_ENGINE", "rules")
MATCHING_MODEL = os.environ.get("MATCHING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
MATCHING_MODEL_CACHE = os.environ.get("MATCHING_MODEL_CACHE", str(BASE_DIR / ".models"))
