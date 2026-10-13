# LocalizaT — identidad visual v4

Los archivos maestros de esta guía están en [`branding/identidad_v4_retorno/`](../../branding/identidad_v4_retorno/). Los nombres de archivo citados abajo se refieren a esa carpeta.

## Concepto

El símbolo es un **candado abstracto abierto**, dibujado con un solo trazo continuo de grosor uniforme. La parte superior funciona como arco de resguardo; las curvas inferiores se enlazan para sugerir encuentro y regreso. La abertura recuerda que la plataforma propone coincidencias, pero la devolución se confirma mediante una persona.

Esta construcción responde a la referencia visual seleccionada por el equipo. No representa ubicación, rastreo, vigilancia ni una garantía automática de recuperación.

## Construcción del isotipo

- Retícula: **100 × 100 unidades**.
- Trazo: **10 unidades** de ancho, extremos y uniones redondeados.
- Un solo recorrido vectorial, sin piezas sueltas ni punto amarillo.
- Abertura visible entre los dos extremos cerca del cuadrante superior derecho.
- Dos curvas inferiores enlazadas con un cruce central; no separar los segmentos ni convertirlos en un icono de cadena.
- Mantener siempre la misma orientación. No espejar, girar, estirar ni cerrar la abertura.

El archivo `01_isotipo.svg` es la fuente maestra. Los demás usos del símbolo se derivan de ese mismo trazado.

## Nombre y composiciones

El nombre conserva exactamente **LocalizaT**. El logotipo usa **Manrope** en peso 750, una sans geométrica y estructurada. Las letras no fueron modificadas; los SVG del nombre están convertidos a curvas para asegurar una reproducción consistente.

- **Imagotipo horizontal:** versión principal para sitio, documentos y señalética.
- **Imagotipo vertical:** portada, cartel o espacio centrado.
- **Isotipo solo:** app, favicon y señal breve.
- **Lockup con lema:** `Lo encontrado puede volver.` cuando el espacio permita explicar la promesa.

No se propone un isologo: meter el nombre dentro de las curvas del candado reduciría la legibilidad y dificultaría el favicon.

## Color

| Función | Color | Uso |
|---|---|---|
| Verde bosque | `#0F4D3A` | Marca, títulos, botones principales y resguardo. |
| Ocre cálido | `#F4B740` | Acción secundaria, detalles de encuentro y acentos. |
| Gris claro | `#F2F3F1` | Fondo editorial principal. |
| Blanco | `#FFFFFF` | Superficies, negativo y pantalla. |
| Verde pálido | `#EAF2ED` | Estados informativos de baja intensidad. |

El verde bosque sobre gris claro ofrece una relación de contraste aproximada de **8.8:1**. El ocre sobre gris claro no es apto para texto pequeño; usarlo como superficie con texto verde bosque o como acento gráfico. El símbolo principal va en un solo color verde. Sobre verde bosque, usarlo blanco; la variante sobre ocre conserva el trazo verde.

## Tipografía

- Marca y encabezados: **Manrope**, peso 750.
- Interfaz y textos: **Manrope**, peso 500.
- Etiquetas y metadatos: Manrope 500 o 700 según tamaño y contraste.

La fuente variable y su licencia **SIL Open Font License 1.1** se guardan en `branding/`. Los SVG de marca no requieren instalarla. Las piezas con texto de interfaz y los mockups pueden usar la fuente incluida para mantener la apariencia.

## Área de protección y tamaños

Definir **x** como el grosor del trazo del isotipo: **10 unidades**. Dejar al menos **2x** libres desde el borde visible de la marca. No acercar bordes, QR, iconos, títulos o fotos a esa zona.

| Pieza | Digital | Impresión |
|---|---:|---:|
| Favicon sobre campo verde | 16 × 16 px | No aplica |
| Isotipo solo | 24 × 24 px | 9 mm de ancho |
| Imagotipo horizontal | 180 px de ancho | 40 mm de ancho |
| Imagotipo vertical | 140 px de ancho | 30 mm de ancho |

En superficies rugosas, bordado o serigrafía, aumentar el tamaño hasta que la abertura superior y los espacios inferiores sigan separados. A 16 px usar el favicon específico, no el isotipo transparente sobre una fotografía.

## Sistema de aplicación

- **Tarjeta:** logo monocromático sobre blanco o blanco sobre verde, con ocre reservado para una línea breve. Las tarjetas fotografiadas son mockups; no son un archivo listo para imprenta. Los SVG `15` y `16` son la base plana editable.
- **Aplicación:** dos entradas claras, `Perdí algo` y `Encontré algo`; las coincidencias se muestran como **posibles** hasta la verificación humana. Evitar porcentajes de certeza o mensajes de entrega automática sin una validación real.
- **Iconografía:** retícula de 64 × 64, trazo lineal uniforme, esquinas suavizadas y etiqueta de texto. Los iconos operativos explican acciones; el candado se reserva como firma de la marca.
- **Recursos gráficos:** curvas aisladas del mismo radio pueden acompañar diagramas de proceso. No repetir el candado como textura densa ni convertirlo en un patrón de seguridad.

## Usos a evitar

- No añadir pin, llave, escudo, check o porcentaje al isotipo.
- No usar amarillo para el trazo principal sobre fondo claro.
- No aplicar sombras, degradados o brillo al SVG maestro.
- No hacer que el símbolo prometa rastreo físico del objeto o seguridad garantizada.
- No reutilizar la pantalla social de la imagen de referencia: LocalizaT trata de pertenencias perdidas, hallazgos, coincidencias y devoluciones verificadas.

## Archivos

| Archivo | Función |
|---|---|
| `01`–`04` | Isotipo principal y variantes de una tinta, negativo y ocre. |
| `05`–`10` | Logotipo e imagotipos horizontal y vertical. |
| `11`–`12` | Favicon e icono de aplicación. |
| `13`–`14` | Lockup con lema y paleta. |
| `15`–`16` | Tarjetas planas editables. |
| `17_mockup_app.png` | Figura mencionada en esta versión de la guía; el archivo no se encuentra actualmente en la carpeta de marca. |
| `18_mockup_tarjetas.png` | Fotografía de tarjetas con el vector aplicado. |
| `19_tablero_identidad_v4.png` | Lámina final de presentación. |
| `02_borrador_visual_candado.png` | Exploración visual con imagegen basada en la referencia; no es el archivo maestro. |

## Origen de la lámina

Se usó **imagegen integrado** para generar una exploración de la lámina y una fotografía de tarjetas en blanco. La fotografía final recibió el logo vectorial mediante composición. El tablero final, el texto de producto, la interfaz y todos los SVG fueron construidos con archivos locales para conservar el nombre y el símbolo de forma consistente.

**Prompt de exploración adaptado:** “Presentación integral de identidad de LocalizaT, servicio comunitario de objetos perdidos y encontrados. Símbolo abstracto de candado abierto, un trazo continuo uniforme con dos curvas inferiores enlazadas; tipografía geométrica moderna; verde bosque `#0F4D3A`, ocre `#F4B740` y gris claro `#F2F3F1`; logo, tarjetas y pantalla móvil. La interfaz muestra reportes de pérdida y hallazgo, posibles coincidencias y entrega verificada por una persona. Evitar pins GPS, contenido de red social genérica, símbolos de IA y promesas de devolución automática.”

## Revisión pendiente

Esta v4 ya corrige la silueta solicitada. Antes de registrarla o imprimirla a gran escala, conviene probar el símbolo sin nombre en tamaños pequeños y revisar posibles similitudes con marcas existentes. La marca visual no sustituye la validación del modelo operativo de LocalizaT.
