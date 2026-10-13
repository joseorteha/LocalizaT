# Evaluación de experiencia de usuario — 7 de octubre de 2026

Revisión heurística del frontend en un celular de 375 × 812 px, con y sin cuenta, contra tres referencias: las 10 heurísticas de usabilidad de Nielsen, WCAG 2.2 y las pautas para uso con poca señal, celulares sencillos y distintos niveles de lectura. Es una revisión de desarrollo: **no sustituye observar a personas de la Sierra usando el sistema**.

## Hallazgos y cambios

| Hallazgo | Principio | Cambio |
|---|---|---|
| La portada escondía el título y los botones hasta terminar una animación; el contenido principal tardaba 4.1 s en verse aun en local. | Visibilidad del estado (Nielsen 1) | Portada estática. Las apariciones al bajar son CSS ligado al desplazamiento (`animation-timeline: view()`) y nunca dejan contenido oculto. |
| `#root` llegaba vacío: pantalla blanca mientras baja el JavaScript. | Visibilidad del estado | Pantalla de arranque en HTML puro dentro de `#root`, más mensaje `noscript`. |
| Primera carga de unos 334 KB (JS 155 KB, fuente TTF 165 KB). | Rendimiento con señal lenta | Se quitaron Motion y Lenis (JS 109 KB, −30 %) y la fuente pasó a WOFF2 con caracteres del español (24 KB, −86 %). La precarga apuntaba al TTF; ahora apunta al WOFF2. Primera carga de unos 147 KB (−56 %). |
| «¿Cómo funciona?» aparecía casi al final. | Correspondencia con el mundo real (Nielsen 2) | Sección movida justo después de la portada; texto de la IA más corto. |
| El reporte se perdía si caía la señal, se recargaba o el celular cerraba la pestaña. | Prevención de errores (Nielsen 5) | Borrador automático (`hooks/useDraft.ts`) con aviso «Recuperamos el reporte que dejaste a medias». **El detalle secreto no se guarda**: en un celular compartido otra persona podría leerlo y reclamar el objeto. |
| Se pedía el lugar dos veces (texto libre y luego municipio). | WCAG 3.3.7, entrada redundante | Municipio en una lista y detalle opcional en el paso 2; el aviso básico usa ese municipio. |
| El paso 3 tenía dos casillas anidadas, un selector y un cuadro de privacidad. | Ley de Hick, carga cognitiva | Una sola pregunta con tres opciones (básico, con mis palabras, nada) y vista previa exacta de lo que se publicará. |
| Errores en burbujas del navegador que desaparecen y quedan bajo el teclado. | Ayudar a recuperarse de errores (Nielsen 9), WCAG 3.3.1 | `noValidate` y mensajes en español debajo de cada campo, con `aria-invalid` y `aria-describedby`, resumen «Revisa N campos» y foco en el primer error. |
| Tras crear la cuenta había que volver a tocar «Guardar». | Eficiencia (Nielsen 7) | El reporte se guarda solo al terminar el inicio de sesión. Botón «Crear cuenta y guardar». |
| Fecha: solo calendario, «Hoy» y «Ayer». | Reconocer antes que recordar (Nielsen 6) | Se añade «Antier» y el día elegido se confirma con palabras. |
| El botón «Atrás» de Android sacaba de la página con una ventana abierta. | Control y libertad (Nielsen 3) | `Modal` agrega una entrada al historial; «Atrás» cierra la ventana. Se desactiva donde la URL ya controla la ventana (`?claim=`). |
| Sin aviso cuando se pierde la conexión. | Visibilidad del estado | Barra «Sin conexión» arriba de la página. |
| Los errores flotantes desaparecían a los 6 s. | WCAG 2.2.1, tiempo suficiente | Las confirmaciones se van solas; los errores se quedan hasta cerrarlos. Avisos a 15 px y por encima de la barra inferior. |
| El filtro de zona en Explorar consultaba al servidor con cada letra. | Reconocer antes que recordar; rendimiento | Lista de municipios. |
| Explorar: el primer aviso quedaba al pie de la pantalla; texto pegado («generalesen»). | Estética y diseño minimalista (Nielsen 8) | Tarjetas en lista compacta en celular, descripción más corta, sello oculto en móvil y espacio corregido. |
| Mi espacio: título y explicación repetidos; reportes sin orden de urgencia. | Diseño minimalista; visibilidad | Encabezado de sección compacto en móvil; primero los casos que piden una acción y al final los cerrados. |
| Texto de pasos pendientes con contraste de unos 3:1. | WCAG 1.4.3 | Color `#66756a` (4.9:1). |
| La barra inferior podía tapar el campo enfocado. | WCAG 2.4.11, foco no oculto | `scroll-padding-bottom` y `scroll-margin-bottom` en móvil. |
| `crypto.randomUUID` falla al probar desde un celular por `http://192.168…`. | Robustez | `newId()` en `lib.ts` con respaldo. |

## Comprobación

Recorrido real a 375 × 812: errores al dejar campos vacíos, borrador recuperado tras recargar, «Atrás» cerrando la ventana de la cuenta sin perder el paso 3, inicio de sesión que guarda y publica solo, aviso sin conexión y Explorar sin desbordamiento. `npm test` (9), `npm run build` y las 25 pruebas de Django pasan. El reporte de prueba se eliminó de la base local.

## Pendiente

- Probar con 4 o 5 personas de la Sierra con sus propios celulares, pidiéndoles una tarea («perdiste tu mochila, repórtala») sin explicar la pantalla.
- Medir la carga real con una conexión 3G lenta en un celular de gama baja.
- Valorar instrucciones por voz o pictogramas y una versión en náhuatl de los textos principales.
- Guardar en el servidor un reporte enviado sin señal (cola local) en vez de solo conservar el borrador.
