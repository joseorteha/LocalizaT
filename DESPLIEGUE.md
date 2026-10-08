# Despliegue de LocalizaT (todo gratis)

Tres piezas, todas sin costo:

| Pieza | Servicio | Qué corre ahí |
|---|---|---|
| **Frontend** | Vercel | La app de React (lo que ve la gente) |
| **Backend + IA** | Contabo (Cloud VPS 4, 8 GB) | Django + worker con la IA semántica |
| **Base de datos** | Neon | Postgres |

La clave: **Vercel reenvía todo lo que empieza con `/api` al backend (Contabo)**
(ver `frontend/vercel.json`). Así el navegador cree que todo es un mismo sitio
y las cookies de inicio de sesión funcionan sin problemas.

---

## Parte A · Base de datos (Neon) — ya lista

Ya tienes la cadena de conexión. Solo falta una cosa **al final**: en Neon entra a
tu proyecto → **Reset password**, porque la contraseña actual quedó a la vista en
capturas. Usa la nueva en el `.env.prod` del servidor.

---

## Parte B · Servidor (Contabo – Cloud VPS 4)

1. Contrata el **Cloud VPS 4** (4 vCPU, 8 GB RAM) en https://contabo.com
   - **Region:** elige **Estados Unidos** (p. ej. Seattle o Nueva York): es lo
     más cercano a México, mejor velocidad.
   - **Image / Sistema operativo:** **Ubuntu 24.04**.
   - **Login:** deja que te manden la **contraseña de root por correo** (o sube
     tu llave SSH si ya tienes una).
   - 💡 La activación puede tardar de unos minutos a unas horas (verifican la
     cuenta). Cuando esté lista, Contabo te envía la **IP** y la contraseña.
2. Entra por SSH desde tu compu (PowerShell o la terminal):
   ```bash
   ssh root@TU_IP
   ```
3. Instala Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
4. En Contabo los puertos 80 y 443 ya vienen abiertos. Por si el cortafuegos
   `ufw` estuviera activo, ábrelos de todos modos:
   ```bash
   ufw allow 80
   ufw allow 443
   ```

---

## Parte C · Dominio gratis (DuckDNS)

1. Entra a https://www.duckdns.org con tu cuenta de Google/GitHub.
2. Crea un subdominio, por ejemplo `localizat-sierra` → quedará `localizat-sierra.duckdns.org`.
3. En el campo **current ip**, pon la **IP pública de tu servidor Oracle** y guarda.

---

## Parte D · Levantar el backend

Conectado por SSH al servidor:

```bash
git clone https://github.com/joseorteha/LocalizaT.git
cd LocalizaT

# Crea el archivo de secretos a partir de la plantilla
cp .env.prod.example .env.prod
nano .env.prod
```

Rellena `.env.prod` con:
- `DOMAIN=localizat-sierra.duckdns.org` (el tuyo)
- `DATABASE_URL=` la cadena **nueva** de Neon
- `DJANGO_SECRET_KEY=` genera una con `openssl rand -hex 32`
- `DJANGO_ALLOWED_HOSTS=localizat-sierra.duckdns.org`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://TU-APP.vercel.app,https://localizat-sierra.duckdns.org`
  (el dominio de Vercel lo tendrás en la Parte E; puedes volver a editarlo luego)

Levanta todo:
```bash
docker compose -f compose.prod.yaml up -d --build
```
La primera vez tarda varios minutos (compila e instala la IA). El worker
descarga el modelo (~220 MB) la primera vez que arranca.

Crea tu usuario administrador:
```bash
docker compose -f compose.prod.yaml exec api python manage.py createsuperuser
```

Prueba que el backend responde:
```bash
curl https://localizat-sierra.duckdns.org/api/health/
```
Debe contestar `ok`. Entra también a `https://localizat-sierra.duckdns.org/admin` y
da de alta los **puntos de custodia** y las cuentas del equipo.

---

## Parte E · Frontend (Vercel)

1. **Antes de subir**, edita `frontend/vercel.json` y cambia `TU-BACKEND.duckdns.org`
   por tu dominio real de DuckDNS. (Haz commit de ese cambio.)
2. En https://vercel.com entra con GitHub e **importa** el repo `LocalizaT`.
3. En la configuración del proyecto:
   - **Root Directory:** `frontend`
   - Framework: Vite (lo detecta solo)
4. **Deploy**. Al terminar te da una URL tipo `https://localizat-xxxx.vercel.app`.
5. Copia esa URL y ponla en `DJANGO_CSRF_TRUSTED_ORIGINS` dentro del `.env.prod`
   del servidor; luego reinicia el backend:
   ```bash
   docker compose -f compose.prod.yaml up -d
   ```

---

## Parte F · Probar

Desde el celular, abre tu URL de Vercel:
- Inicia sesión (debe funcionar sin errores).
- Haz un reporte de prueba y revisa que aparezcan coincidencias (eso usa la IA).
- El navegador debe ofrecerte **instalar LocalizaT** con el ícono nuevo.

---

## Si algo falla

- **`prepared statement already exists` al migrar:** en Neon apaga *Connection
  pooling* y usa la cadena **directa** (sin `-pooler`) en `DATABASE_URL`.
- **Error de autenticación de la base:** quita `&channel_binding=require` del final
  de `DATABASE_URL`.
- **La página de Vercel no habla con el backend:** revisa que el dominio en
  `frontend/vercel.json` esté bien escrito y que `curl .../api/health/` responda.
- **El backend no abre en el navegador:** revisa el cortafuegos del servidor
  (Parte B, paso 4) y que Docker esté corriendo (`docker compose -f compose.prod.yaml ps`).

---

## Mantenimiento

**Actualizar** cuando subas cambios a `main`:
```bash
cd LocalizaT && git pull && docker compose -f compose.prod.yaml up -d --build
```

**Respaldo de la base** (guárdalo seguido):
```bash
docker run --rm -e PGPASSWORD=TU_PASSWORD postgres:17-alpine \
  pg_dump -h TU_HOST_NEON -U neondb_owner neondb > respaldo-$(date +%F).sql
```

> El VPS no se duerme: el backend queda encendido 24/7. Neon sí duerme con
> inactividad, pero despierta en menos de un segundo.
