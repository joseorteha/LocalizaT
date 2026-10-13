# LocalizaT — problema y alternativas

**Versión:** 0.1 — 4 de octubre de 2026  
**Estado:** borrador de investigación. Las afirmaciones sobre la comunidad requieren casos o datos locales.  
**Propósito:** completar el primer tramo de la memoria de trabajo antes de decidir tecnología, empresa o inversión.

## 1. Problema que queremos investigar

Una persona puede perder una pertenencia en un trayecto que incluye transporte, comercios, escuela y espacios públicos. Puede buscarla preguntando en esos lugares o publicando en grupos. A la vez, alguien puede encontrarla y querer devolverla, pero usar otro canal o no saber dónde dejarla. **La hipótesis central** es que esta falta de conexión reduce las devoluciones posibles y aumenta el tiempo de búsqueda y resguardo.

Todavía **no sabemos** con qué frecuencia ocurre en la zona elegida, cuántos objetos encontrados se devuelven hoy, cuáles son los puntos de mayor concentración ni qué proporción de halladores utilizaría un servicio nuevo. La encuesta y las entrevistas deben aportar esa evidencia. No convertir una historia ilustrativa en dato.

### Problema delimitado

LocalizaT se dirige a **objetos extraviados que otra persona o institución está dispuesta a reportar o devolver**. Una persona que decide retener un objeto no puede ser obligada por la plataforma. El robo, la investigación policial y el rastreo GPS están fuera de la promesa del producto.

### Cambio que buscamos

Que un hallazgo registrado por una persona o Punto LocalizaT pueda llegar a la búsqueda de su dueño, y que la entrega sea verificable y segura. La medida final es una **devolución correcta**, no el número de avisos ni de coincidencias generadas.

## 2. Tres respuestas posibles al mismo problema

| Alternativa | Cómo funcionaría | Qué puede resolver | Principal límite |
|---|---|---|---|
| **A. Avisos coordinados sin plataforma nueva** | Formato estándar de publicación y difusión mediante grupos, comercios y carteles con un contacto central. | Puede comenzar rápido y usa canales conocidos. | Sigue dependiendo de trabajo manual, alcance de cada grupo y exposición de datos. |
| **B. Red de puntos con registro compartido, sin IA** | Establecimientos aceptan hallazgos; un registro común permite buscar por categoría, fecha y zona; una persona revisa reclamos. | Añade lugar físico, trazabilidad y un sitio para consultar. | Las descripciones diferentes o trayectos inciertos pueden dificultar el encuentro; la revisión crece con el volumen. |
| **C. LocalizaT: puntos + sugerencias de IA** | Mantiene la red y el registro de B; la IA interpreta descripciones libres y ordena posibles coincidencias por objeto, tiempo y zona. La entrega sigue bajo revisión humana. | Podría descubrir casos que filtros o palabras clave no relacionan y ahorrar tiempo de búsqueda. | Necesita suficientes registros; puede sugerir coincidencias erróneas y añade costo técnico y de supervisión. |

### Comparación provisional

| Criterio | A | B | C |
|---|---|---|---|
| Impacto potencial | Limitado por fragmentación | Mejora si hay puntos activos | Puede mejorar B si la IA acierta y reduce trabajo |
| Viabilidad de arranque | Alta | Depende de acuerdos con puntos | Depende de los mismos acuerdos y de una prueba de IA |
| Accesibilidad | Familiar para usuarios de grupos; excluye a otros | Puede ofrecer registro asistido | Igual que B si la IA trabaja detrás del proceso |
| Costo operativo | Coordinación manual | Custodia y registro | Custodia, registro, infraestructura y revisión de IA |

Esta tabla **no asigna calificaciones**: faltan datos para hacerlo. B y C comparten la dificultad decisiva de conseguir hallazgos registrados y puntos participantes. La IA no resuelve por sí sola esa dificultad.

## 3. Decisión que debe salir de la investigación

Para defender C ante NAUFest y como producto real, demostrar dos cosas distintas:

1. **La red sirve:** personas y establecimientos aceptarían registrar o consultar objetos mediante un proceso concreto.
2. **La IA añade valor:** con los mismos reportes, sus sugerencias encuentran coincidencias útiles que B omite o reducen el tiempo de revisión sin aumentar demasiado los falsos avisos.

Si la primera falla, hay que cambiar el segmento o la forma de operar. Si la segunda falla, la parte de IA debe rediseñarse; no basta con incluirla para cumplir el nombre del reto.

## 4. Evidencia pendiente, en orden

1. **Casos locales:** registrar al menos tres historias verificables con zona general, objeto, búsqueda, hallazgo, resultado y fuente, sin divulgar datos personales.
2. **Encuesta:** separar resultados de quien perdió, encontró y custodia objetos. Contar también los “no” y las objeciones.
3. **Entrevistas a puntos:** observar qué hacen hoy con los objetos y quién autorizaría participar.
4. **Comparación funcional:** probar un pequeño conjunto de descripciones anónimas con filtros sencillos y con una propuesta de IA.
5. **Selección de piloto:** elegir una sola zona y tipo de punto según frecuencia de casos, disposición y capacidad de custodia.

## 5. Texto provisional del problema para la propuesta

> En la zona donde se pruebe LocalizaT, la búsqueda de una pertenencia puede repartirse entre preguntas presenciales, publicaciones y registros separados de escuelas, comercios o transporte. Quien la encuentra puede estar dispuesto a devolverla, pero no saber cómo contactar al dueño o dónde dejarla. Queremos comprobar cuántas devoluciones se pierden por esa desconexión y probar una manera confiable de unir ambos reportes.

Este texto se ajustará cuando tengamos un caso observado y resultados de campo. No afirma una magnitud que todavía no se ha medido.
