# LocalizaT — recorrido operativo inicial

**Versión:** 0.1 — 4 de octubre de 2026  
**Estado:** diseño para discutir y probar; todavía no es un protocolo aprobado para recibir objetos reales.

## 1. Actores y responsabilidad propuesta

| Actor | Acción | Límite |
|---|---|---|
| Persona que perdió algo | Describe pérdida, zona/periodo aproximados y una característica que solo ella conocería. | Su declaración no demuestra por sí sola la propiedad. |
| Persona que encontró algo | Entrega a un punto o registra el hallazgo por un canal definido. | No se le pide publicar datos sensibles ni reunirse obligatoriamente con un extraño. |
| Punto LocalizaT | Recibe, identifica, guarda y entrega según un acuerdo escrito. | Solo hace tareas y acepta categorías que decidió asumir. |
| Operación LocalizaT | Revisa casos dudosos, coordina con el punto y conserva un historial de decisiones. | No debe aprobar automáticamente una entrega por una sugerencia de IA. |
| Sistema e IA | Ordenan y sugieren posibles coincidencias a partir de datos mínimos. | No determinan quién es dueño ni dónde está un objeto que nadie registró. |

Los cargos de una futura empresa se definirán después. Primero hay que saber qué tareas son necesarias, quién puede realizarlas y cuánto tiempo requieren.

## 2. Flujo principal de un caso

**Escenario de prueba:** alguien pierde una mochila en un trayecto; otra persona la lleva a un punto participante. Es un ejemplo inventado para diseñar el proceso, no un caso local verificado.

| Paso | Quién actúa | Información mínima | Resultado y control |
|---|---|---|---|
| 1. Reportar pérdida | Dueño o personal que le ayuda | Tipo, descripción general, fecha, zona o trayecto, medio de contacto privado | Reporte con identificador; una pista distintiva se reserva y no se publica. |
| 2. Recibir hallazgo | Punto o hallador | Tipo, descripción, fecha, lugar aproximado, condición visible | Constancia de recepción y responsable físico del objeto. |
| 3. Guardar | Punto | Identificador de inventario y lugar de resguardo | El objeto queda localizable internamente; no se publica el lugar exacto antes de revisar la reclamación. |
| 4. Buscar coincidencias | Sistema | Solo atributos necesarios de los dos reportes | Lista de posibles coincidencias, con motivos legibles: tipo, tiempo, zona y rasgos. |
| 5. Revisar sugerencia | Operador o punto capacitado | Descripciones y evidencia privada permitida | Se descartan errores evidentes; una sugerencia no equivale a autorización de entrega. |
| 6. Verificar reclamación | Responsable designado | Detalle reservado, evidencia adicional apropiada al objeto y registro de revisión | Decisión documentada. Si hay duda, se detiene la entrega y se escala el caso. |
| 7. Coordinar entrega | Punto y dueño | Referencia del caso, horario y lugar de retiro | Entrega en un lugar acordado y público, con constancia de recepción. |
| 8. Cerrar y medir | Operación | Resultado, fechas y tiempo de trabajo | Caso cerrado; se registra devolución correcta, error o abandono, sin conservar datos innecesarios. |

## 3. Ramas que el producto debe resolver

| Situación | Respuesta inicial para probar | Decisión pendiente |
|---|---|---|
| No aparece coincidencia | Mantener ambos reportes según un plazo definido y volver a comparar cuando ingrese otro. | Plazo de conservación y canal de seguimiento. |
| Varias personas reclaman | No revelar pistas adicionales ni entregar hasta una revisión más fuerte. | Quién arbitra, qué prueba basta y cómo documentar desacuerdo. |
| Coincidencia falsa | Permitir descartarla y registrar el motivo para mejorar el proceso. | Umbral para avisar sin saturar a usuarios. |
| Hallador no quiere custodiar | Ofrecer un punto cercano que aceptó esa categoría. | Cobertura y horario real de los puntos. |
| Punto no puede guardar más | Derivar a otro punto solo con aceptación explícita y registro del traslado. | Capacidad, inventario y responsable durante el traslado. |
| Documento, celular o efectivo | Tratar como categoría especial; no publicar contenido sensible ni asumir un procedimiento único. | Protocolo específico y revisión jurídica/operativa antes del piloto real. |
| Sospecha de robo o riesgo personal | Pausar la gestión de entrega y remitir al canal competente cuando corresponda. | Criterios y contactos locales verificables. |

## 4. Datos públicos y privados

**Público, si se decide mostrar un aviso:** categoría, fecha aproximada y zona amplia. Publicar la menor cantidad útil para que alguien busque.

**Privado y con acceso limitado:** contacto, detalle distintivo, información de custodia y notas de verificación. Evitar almacenar fotografías de identificaciones, números de documento, direcciones o contenido de un celular salvo que se justifique y exista un proceso adecuado.

**Nunca presentar como certeza automática:** un porcentaje de coincidencia, una etiqueta de “dueño confirmado” o una ubicación exacta antes de la revisión.

## 5. Prueba sin desarrollar la plataforma

Preparar dos o tres pantallas o tarjetas: “Perdí algo”, “Encontré algo” y “Posible coincidencia”. Simular una comparación con casos ficticios. Pedir a dos personas que expliquen con sus palabras cómo se recuperaría el objeto y quién decide la entrega. Registrar confusiones antes de diseñar más funciones.

Para probar el valor de IA, usar después un conjunto pequeño de pares de descripciones **ficticias o anonimizadas**. Comparar búsqueda manual por categoría/palabras clave contra sugerencias semánticas. Medir aciertos, falsos positivos y minutos de revisión. No entrenar ni enviar datos personales de la encuesta a un proveedor de IA sin definir antes cómo se protegerían.

## 6. Decisiones bloqueadas por investigación

1. Zona y tipo de institución del primer piloto.
2. Categorías de objetos aceptadas.
3. Quién asume la custodia y durante cuánto tiempo.
4. Evidencia mínima para entregar cada categoría.
5. Canal principal de registro y asistencia para personas sin acceso fácil a internet.
6. Número de puntos y volumen esperado para estimar costos.

Cuando estas seis decisiones tengan respuestas, podremos calcular un presupuesto de piloto con cantidades reales: señalética, horas de capacitación, tiempo por registro, apoyo operativo, software y seguridad.
