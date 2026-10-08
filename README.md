# LocalizaT

LocalizaT es un prototipo para conectar a quienes perdieron y encontraron objetos en la Sierra de Zongolica. Permite publicar avisos, explorar un catálogo y un mapa por municipio, recibir posibles coincidencias y coordinar una devolución con verificación humana.

El proyecto está en desarrollo. La búsqueda de coincidencias usa reglas actuales; la IA semántica planteada para una fase posterior todavía no está integrada. Las coincidencias son sugerencias, no pruebas de propiedad ni devoluciones automáticas.

## Tecnología

- **Backend:** Django y Python, con aplicaciones para cuentas, reportes, coincidencias, reclamaciones, custodia, notificaciones y auditoría.
- **Frontend:** React, TypeScript y Vite.
- **Datos:** PostgreSQL.
- **Entorno local:** Docker Compose, con servicios para base de datos, API, trabajador de coincidencias y frontend.

## Ejecutar localmente

1. Instala Docker Desktop y activa el motor.
2. Copia `.env.example` a `.env` y reemplaza `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` por valores locales propios. Las claves VAPID son opcionales para probar avisos push.
3. Ejecuta `docker compose up --build -d` desde la raíz del repositorio.
4. Abre `http://localhost:5173`. La comprobación de la API está en `http://localhost:8000/api/health/`.

Para consultar la API: `docker compose logs -f api`. Para detener los servicios sin borrar la base: `docker compose down`.

La configuración de Compose está pensada para **desarrollo local**. Usa el servidor de desarrollo de Django y aún requiere endurecimiento, despliegue seguro y validación operativa antes de un piloto público.

## Comprobar el código

```powershell
docker compose exec api python manage.py test accounts reports matching claims custody notifications audit
cd frontend
npm ci
npm test
npm run build
```

## Organización

| Ruta | Contenido |
| --- | --- |
| `backend/config/` | Configuración y rutas de Django. |
| `backend/accounts/`, `backend/reports/` | Cuentas, reportes y catálogo público. |
| `backend/matching/`, `backend/claims/`, `backend/custody/` | Coincidencias, reclamaciones y entrega. |
| `backend/notifications/`, `backend/audit/` | Avisos y registro de decisiones. |
| `frontend/src/pages/` | Inicio, exploración, reportes, espacio personal y operación. |
| `frontend/src/components/`, `frontend/public/` | Componentes y recursos visuales de la aplicación. |

Los avisos push se activan voluntariamente y se envían ante posibles coincidencias. Las ubicaciones públicas son aproximadas para proteger a las personas. La recuperación de cuentas, las fotos privadas y la validación de uso en dispositivos de la Sierra siguen pendientes.

Este repositorio contiene solo el código y los archivos necesarios para ejecutarlo. Los documentos de investigación, datos de encuesta y entregables de la convocatoria se conservan fuera del repositorio.
