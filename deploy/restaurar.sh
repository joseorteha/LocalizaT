#!/bin/sh
# Restaura un respaldo hecho con respaldar.sh. BORRA lo que haya en la base actual.
#
#   sh deploy/restaurar.sh deploy/respaldos/base_2026-10-12_0330.dump [deploy/respaldos/fotos_2026-10-12_0330.tar.gz]
#
# Recomendado: primero restaura en una rama nueva de Neon (consola de Neon →
# Branches → Create branch), pon su DATABASE_URL en .env.prod, comprueba que todo
# esté bien y solo entonces cambia la principal.
set -eu
cd "$(dirname "$0")/.."

BASE="${1:?Indica el archivo base_*.dump}"
FOTOS="${2:-}"
DATABASE_URL=$(grep '^DATABASE_URL=' .env.prod | cut -d= -f2-)

printf "Esto reemplaza la base de datos actual con %s. Escribe SI para seguir: " "$BASE"
read -r RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado."; exit 1; }

docker compose -f compose.prod.yaml stop api worker
docker run --rm -i -e DATABASE_URL="$DATABASE_URL" postgres:17-alpine \
  sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL"' < "$BASE"

if [ -n "$FOTOS" ]; then
  docker run --rm -i -v localizat-prod_private_media:/datos alpine \
    sh -c 'rm -rf /datos/* && tar xzf - -C /datos' < "$FOTOS"
fi

docker compose -f compose.prod.yaml up -d
echo "Restauración terminada. Revisa https://$(grep '^DOMAIN=' .env.prod | cut -d= -f2-)/api/health/"
