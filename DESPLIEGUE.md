# Despliegue de LocalizaT (todo gratis)

Dos piezas, todas sin costo (fuera del VPS de ~$5/mes):

| Pieza | Servicio | Qué corre ahí |
|---|---|---|
| **Frontend + Backend + IA** | Contabo (Cloud VPS 4, 8 GB) | Caddy sirve la app de React y reenvía `/api` a Django + worker con la IA |
| **Base de datos** | Neon | Postgres |

Todo vive en **un solo dominio** (`localizat.duckdns.org`): Caddy sirve el
frontend compilado y manda `/api`, `/admin` y `/static` a Django. Al ser el mismo
dominio, las cookies de inicio de sesión funcionan sin complicaciones.

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
2. Crea un subdominio, por ejemplo `localizat` → quedará `localizat.duckdns.org`.
3. En el campo **current ip**, pon la **IP pública de tu servidor Contabo** y guarda.

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
- `DOMAIN=localizat.duckdns.org` (el tuyo)
- `DATABASE_URL=` la cadena **nueva** de Neon
- `DJANGO_SECRET_KEY=` genera una con `openssl rand -hex 32`
- `DJANGO_ALLOWED_HOSTS=localizat.duckdns.org`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://localizat.duckdns.org`

Levanta todo:
```bash
docker compose -f compose.prod.yaml up -d --build
```
La primera vez tarda varios minutos (compila el frontend, instala la IA). El
worker descarga el modelo (~220 MB) la primera vez que arranca.

Crea tu usuario administrador:
```bash
docker compose -f compose.prod.yaml exec api python manage.py createsuperuser
```

Prueba que responde:
```bash
curl https://localizat.duckdns.org/api/health/
```
Debe contestar `ok`. Con eso, **la app completa ya está en vivo** en
`https://localizat.duckdns.org` (Caddy sirve el frontend y reenvía `/api`).

Crea tu usuario administrador y da de alta los datos iniciales:
```bash
docker compose -f compose.prod.yaml exec api python manage.py createsuperuser
```
Entra a `https://localizat.duckdns.org/admin` y registra los **puntos de
custodia** y las cuentas del equipo.

---

## Parte E · Probar

Desde el celular, abre **https://localizat.duckdns.org**:
- Inicia sesión (debe funcionar sin errores).
- Haz un reporte de prueba y revisa que aparezcan coincidencias (eso usa la IA).
- El navegador debe ofrecerte **instalar LocalizaT** con el ícono nuevo.

---

## Si algo falla

- **`prepared statement already exists` al migrar:** en Neon apaga *Connection
  pooling* y usa la cadena **directa** (sin `-pooler`) en `DATABASE_URL`.
- **Error de autenticación de la base:** quita `&channel_binding=require` del final
  de `DATABASE_URL`.
- **La app no abre en el navegador:** revisa el cortafuegos del servidor
  (Parte B, paso 4), que el dominio DuckDNS apunte a la IP correcta, y que todo
  esté corriendo (`docker compose -f compose.prod.yaml ps`).
- **Caddy no saca el certificado HTTPS:** casi siempre es que DuckDNS no apunta
  aún a la IP del servidor, o que el puerto 80/443 está cerrado. Mira los logs:
  `docker compose -f compose.prod.yaml logs caddy`.

---

## Parte F · Correo, monitoreo y respaldos

Estas tres piezas hacen que LocalizaT avise a la gente, que tú te enteres si
algo falla y que no se pierdan datos. Las tres son gratis.

### 1. Correo (avisos de coincidencias, recuperar contraseña, verificar correo)
1. Crea una cuenta gratis en **Brevo** (300 correos al día) o Resend.
2. En Brevo: **Remitentes y dominios › Agregar remitente** y verifica el correo
   desde el que saldrán los avisos.
3. En **SMTP y API › SMTP** copia el usuario y genera una clave SMTP.
4. En el servidor, edita `.env.prod`:
   ```
   EMAIL_HOST=smtp-relay.brevo.com
   EMAIL_PORT=587
   EMAIL_HOST_USER=tu-usuario-smtp@smtp-brevo.com
   EMAIL_HOST_PASSWORD=la-clave-smtp
   DEFAULT_FROM_EMAIL=LocalizaT <el-correo-que-verificaste@ejemplo.com>
   ```
5. `docker compose -f compose.prod.yaml up -d` y prueba «¿Olvidaste tu
   contraseña?» con tu cuenta. Si no llega, mira
   `docker compose -f compose.prod.yaml logs worker | grep -i correo`.

Sin `EMAIL_HOST` todo funciona, pero los correos solo se escriben en el registro
del worker y no salen.

### 2. Monitoreo
- **¿Se cayó el sitio?** Crea una cuenta gratis en **UptimeRobot** y un monitor
  tipo *Keyword* a `https://localizat.duckdns.org/api/health/` cada 5 minutos,
  buscando la palabra `"worker": "ok"`. Te llega un correo si la página no abre
  **o** si el worker (coincidencias, push y correos) dejó de trabajar.
- **¿Hay errores?** Crea un proyecto *Django* gratis en **sentry.io**, copia su
  DSN a `SENTRY_DSN=` en `.env.prod` y reinicia. Ahí verás los errores del
  servidor y también los que vean las personas en su navegador. No se envían
  correos ni datos personales.

### 3. Respaldos
Neon gratis solo deja **volver 6 horas atrás** y no hace respaldos programados.
El script `deploy/respaldar.sh` guarda cada día la base de datos y las fotos
privadas en el servidor, y conserva 14 días:
```bash
chmod +x deploy/respaldar.sh deploy/restaurar.sh
sh deploy/respaldar.sh          # pruébalo una vez a mano
crontab -e                      # y prográmalo:
30 3 * * * cd ~/LocalizaT && sh deploy/respaldar.sh >> deploy/respaldos/registro.log 2>&1
```
Para restaurar: `sh deploy/restaurar.sh deploy/respaldos/base_FECHA.dump deploy/respaldos/fotos_FECHA.tar.gz`
(primero en una rama nueva de Neon si puedes). De vez en cuando copia la carpeta
`deploy/respaldos/` fuera del servidor (por ejemplo con `scp` a tu computadora).

---

## Mantenimiento

**Actualizar** cuando subas cambios a `main`:
```bash
cd LocalizaT && git pull && docker compose -f compose.prod.yaml up -d --build
```

**Cifras del servicio** (para informes): en el panel del equipo, sección
**Resumen**, botón «Descargar cifras».

**Medir el motor de coincidencias con casos reales** (cuando ya haya
devoluciones aprobadas):
```bash
docker compose -f compose.prod.yaml exec worker python manage.py export_matching_cases --salida /tmp/casos_reales.json
docker compose -f compose.prod.yaml exec worker python manage.py evaluate_matching --cases /tmp/casos_reales.json --details
```
El archivo tiene descripciones privadas: no lo saques del servidor ni lo subas a Git.

> El VPS no se duerme: el backend queda encendido 24/7. Neon sí duerme con
> inactividad, pero despierta en menos de un segundo.
