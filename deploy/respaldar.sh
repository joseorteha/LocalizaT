#!/bin/sh
# Respaldo de LocalizaT: base de datos (Neon) + fotos privadas de los objetos.
#
# Neon gratis solo permite volver 6 horas atrás y no hace respaldos programados,
# así que este script guarda una copia diaria en el servidor y conserva 14 días.
#
# Uso (en el servidor, dentro de ~/LocalizaT):
#   sh deploy/respaldar.sh
# Programarlo cada día a las 3:30 a. m. (crontab -e):
#   30 3 * * * cd ~/LocalizaT && sh deploy/respaldar.sh >> deploy/respaldos/registro.log 2>&1
set -eu

cd "$(dirname "$0")/.."
DEST="deploy/respaldos"
DIAS=14
mkdir -p "$DEST"
FECHA=$(date +%Y-%m-%d_%H%M)

DATABASE_URL=$(grep '^DATABASE_URL=' .env.prod | cut -d= -f2-)
if [ -z "$DATABASE_URL" ]; then
  echo "No encontré DATABASE_URL en .env.prod" >&2
  exit 1
fi

# pg_dump corre en un contenedor de un solo uso: no hay que instalar nada.
docker run --rm -e DATABASE_URL="$DATABASE_URL" postgres:17-alpine \
  sh -c 'pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges' \
  > "$DEST/base_$FECHA.dump"

# Fotos privadas (volumen de Docker del servicio api).
docker run --rm -v localizat-prod_private_media:/datos:ro alpine \
  tar czf - -C /datos . > "$DEST/fotos_$FECHA.tar.gz"

# Un respaldo vacío es peor que ninguno: avisa si salió demasiado chico.
TAM=$(wc -c < "$DEST/base_$FECHA.dump")
if [ "$TAM" -lt 2000 ]; then
  echo "$(date) AVISO: el respaldo de la base pesa solo $TAM bytes. Revísalo." >&2
  exit 1
fi

find "$DEST" -type f \( -name 'base_*.dump' -o -name 'fotos_*.tar.gz' \) -mtime +$DIAS -delete
echo "$(date) Respaldo listo: base_$FECHA.dump ($TAM bytes) y fotos_$FECHA.tar.gz"
