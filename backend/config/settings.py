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

# Proxies delante de Django (Caddy en producción = 1). Con esto los límites de
# intentos ven la IP real de la persona y no la del proxy.
NUM_PROXIES = int(os.environ.get("NUM_PROXIES", "0"))

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "NUM_PROXIES": NUM_PROXIES,
    # Freno general contra abuso. Las acciones sensibles tienen su propio límite.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",
        "user": "240/min",
        "report_create": "20/hour",
        "abuse": "10/hour",
        "photo_upload": "30/hour",
        "client_error": "20/hour",
        "feedback": "10/hour",
    },
}

# Caché compartida entre los procesos de gunicorn y el worker: guarda los
# contadores de intentos y el latido del worker. Usa la propia base de datos
# para no sumar otro servicio (crear con `manage.py createcachetable`).
CACHES = {"default": {
    "BACKEND": "django.core.cache.backends.db.DatabaseCache",
    "LOCATION": "localizat_cache",
}}
if os.environ.get("TEST_DB_ENGINE") == "sqlite":
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Límites de los formularios de cuenta (intentos por ventana de tiempo).
AUTH_RATE_LIMITS = {
    "login_ip": (20, 15 * 60),        # por IP
    "login_email": (6, 15 * 60),      # por correo: frena adivinar contraseñas
    "signup_ip": (8, 60 * 60),
    "google_ip": (30, 15 * 60),
    "reset_ip": (6, 60 * 60),
    "reset_email": (3, 60 * 60),
    "verify_resend": (3, 60 * 60),
}

# Dirección pública del sitio: se usa en los enlaces de los correos.
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/") or (
    f"https://{os.environ['DOMAIN']}" if os.environ.get("DOMAIN") else "http://localhost:5173"
)

# Correo saliente (avisos, recuperar contraseña, verificar cuenta). Funciona con
# cualquier SMTP: Brevo, Resend, Gmail con contraseña de aplicación… Sin
# EMAIL_HOST, los correos se escriben en el registro del servidor y no salen.
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1" and EMAIL_PORT != 465
EMAIL_USE_SSL = EMAIL_PORT == 465
EMAIL_TIMEOUT = 15
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "LocalizaT <no-responder@localizat.mx>")
PASSWORD_RESET_TIMEOUT = 60 * 60 * 2  # el enlace para cambiar la contraseña dura 2 horas

# Fotos privadas de los objetos: viven FUERA de la carpeta pública y solo se
# entregan a través de Django a quien tiene permiso (dueño del reporte o equipo).
PRIVATE_MEDIA_ROOT = Path(os.environ.get("PRIVATE_MEDIA_ROOT", str(BASE_DIR / "private-media")))
PHOTO_MAX_BYTES = 8 * 1024 * 1024
PHOTO_MAX_PER_REPORT = 3
PHOTO_MAX_SIDE = 1600

# Denuncias: con este número de denuncias abiertas, el aviso sale del catálogo
# y pasa a revisión del equipo hasta que alguien decida.
ABUSE_AUTO_REVIEW_THRESHOLD = 3

# Monitoreo de errores (opcional). Crea un proyecto gratis en sentry.io y pon su DSN.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        send_default_pii=False,  # sin correos ni IP de las personas
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
        environment=os.environ.get("SENTRY_ENVIRONMENT", "produccion"),
    )

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"localizat": {"handlers": ["console"], "level": "INFO"}},
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
# es público (va dentro del frontend); por eso puede quedar aquí por defecto.
# Se puede sobreescribir con la variable GOOGLE_OAUTH_CLIENT_ID (otro proyecto).
GOOGLE_OAUTH_CLIENT_ID = (
    os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    or "272400437839-pugsqfr08vng1bcas5ortera9jlmt6c1.apps.googleusercontent.com"
)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@localizat.example")

# Coincidencias: "rules" (palabras exactas) o "semantic" (palabras normalizadas
# más un modelo de lenguaje local). Comparar ambos con `manage.py evaluate_matching`.
MATCHING_ENGINE = os.environ.get("MATCHING_ENGINE", "rules")
MATCHING_MODEL = os.environ.get("MATCHING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
MATCHING_MODEL_CACHE = os.environ.get("MATCHING_MODEL_CACHE", str(BASE_DIR / ".models"))
