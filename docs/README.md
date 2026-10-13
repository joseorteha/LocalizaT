# Documentación de LocalizaT

Objetos perdidos y encontrados para la **Sierra de Zongolica**, Veracruz. Proyecto del Challenge NAUFest 2026 #AIForImpact.

**¿Por dónde empiezo?** Lee primero [**Cómo funciona el sistema completo**](04_ingenieria/11_SISTEMA_COMPLETO_LocalizaT.md). Explica todo de punta a punta, con diagramas de casos de uso, secuencias, estados, el modelo de datos y el despliegue.

## Mapa de la documentación

| Carpeta | Documento | De qué trata |
|---|---|---|
| **01 · Proyecto** | [Problema y alternativas](01_proyecto/01_PROBLEMA_Y_ALTERNATIVAS_LocalizaT.md) | Qué problema resolvemos, para quién y qué otras opciones existen. |
| **02 · Investigación** | [Análisis de la encuesta (214 respuestas)](02_investigacion/analisis_encuesta_214_y_diagramas.md) | Qué dijo la gente sobre perder y encontrar objetos, con su método y sus límites. |
| | [Investigación inicial de mercado](02_investigacion/INVESTIGACION_MERCADO_INICIAL.md) | Servicios parecidos y en qué podría distinguirse LocalizaT. |
| **03 · Operación** | [Flujo operativo](03_operacion/02_FLUJO_OPERATIVO_LocalizaT.md) | Cómo se mueve un objeto: reporte, custodia, verificación y entrega. |
| | [Prueba con personas de la Sierra](03_operacion/03_PRUEBA_CON_PERSONAS.md) | Guía para probar la app con gente real, con 8 tareas y qué observar. |
| **04 · Ingeniería** | [**Sistema completo** (empieza aquí)](04_ingenieria/11_SISTEMA_COMPLETO_LocalizaT.md) | Estado actual de todo el sistema, con 17 diagramas. |
| | [Motor semántico de coincidencias](04_ingenieria/10_MOTOR_SEMANTICO_2026-10-07.md) | Cómo compara la IA las descripciones y cómo se evaluó. |
| | [Arquitectura del sistema](04_ingenieria/05_ARQUITECTURA_DEL_SISTEMA_LocalizaT.md) | Decisiones de diseño y su porqué (documento de diseño). |
| | [Especificación técnica general](04_ingenieria/06_ESPECIFICACION_TECNICA_GENERAL_LocalizaT.md) | Alcance, módulos, estados y criterios de prueba (documento de diseño). |
| | [Backend implementado](04_ingenieria/07_BACKEND_IMPLEMENTADO_LocalizaT.md) | Corte del 6 de octubre: reglas del backend y rutas. |
| | [Mapa regional y avisos push](04_ingenieria/09_MAPA_Y_PUSH_2026-10-06.md) | Cómo funcionan los avisos push y la primera versión del mapa. |
| **06 · Diseño** | [Guía de identidad v4](06_diseno/GUIA_IDENTIDAD_LocalizaT_v4.md) | Logo, colores, tipografía y tono. |
| | [Interfaz implementada](06_diseno/INTERFAZ_IMPLEMENTADA_LocalizaT.md) | Pantallas y componentes de la app. |
| | [Mejoras de claridad](06_diseno/MEJORAS_CLARIDAD_LocalizaT.md) | Cambios para que el recorrido se entienda sin ayuda. |
| | [Evaluación de experiencia de usuario](06_diseno/UX_EVALUACION_2026-10-07.md) | Hallazgos y cambios de la revisión del 7 de octubre. |
| | [Revisión de «Mi espacio»](06_diseno/UX_UI_MI_ESPACIO_2026-10-06.md) | Cómo se ordenó el seguimiento de cada caso. |

## Otros documentos del repositorio
- [`DESPLIEGUE.md`](../DESPLIEGUE.md): cómo poner LocalizaT en un servidor, con el correo, el monitoreo y los respaldos.
- [`frontend/traduccion-nahuatl.csv`](../frontend/traduccion-nahuatl.csv): la hoja para traducir los textos principales al náhuatl de la Sierra.

## Cómo leer las fechas
Los documentos con fecha en el nombre (por ejemplo `09_MAPA_Y_PUSH_2026-10-06`) son **cortes históricos**: cuentan cómo estaba el sistema ese día y llevan una nota arriba si algo cambió después. El documento vivo es el **sistema completo**.

> Los documentos internos (planeación, prompts de herramientas de diseño y materiales del curso) se quedan fuera del repositorio.
