# LocalizaT · Cómo funciona el sistema completo

**Versión:** 12 de octubre de 2026 · rama `produccion-completa`
**Para quién:** quien necesite entender LocalizaT de punta a punta (equipo, jurado de NAUFest, quien lo mantenga después). Cada sección empieza con la idea en palabras sencillas y luego entra al detalle técnico.

> **En una frase:** LocalizaT conecta a quien perdió algo con quien lo encontró en la Sierra de Zongolica. La IA sugiere posibles coincidencias entre descripciones, pero **siempre decide una persona**: el equipo comprueba un detalle secreto antes de cualquier entrega.

---

## Índice
1. [Panorama general](#1-panorama-general)
2. [Quién usa LocalizaT (actores y casos de uso)](#2-quién-usa-localizat-actores-y-casos-de-uso)
3. [El viaje de un objeto, de la pérdida a la devolución](#3-el-viaje-de-un-objeto-de-la-pérdida-a-la-devolución)
4. [Crear un reporte (con o sin señal)](#4-crear-un-reporte-con-o-sin-señal)
5. [El motor de coincidencias (la IA)](#5-el-motor-de-coincidencias-la-ia)
6. [Avisos públicos, moderación y denuncias](#6-avisos-públicos-moderación-y-denuncias)
7. [Reclamar, verificar y entregar](#7-reclamar-verificar-y-entregar)
8. [Avisos a las personas: bandeja, push y correo](#8-avisos-a-las-personas-bandeja-push-y-correo)
9. [Cuentas: registro, Google, verificación y recuperación](#9-cuentas-registro-google-verificación-y-recuperación)
10. [Estados de cada pieza](#10-estados-de-cada-pieza)
11. [Modelo de datos](#11-modelo-de-datos)
12. [Mapa de la Sierra](#12-mapa-de-la-sierra)
13. [Panel del equipo y métricas](#13-panel-del-equipo-y-métricas)
14. [Seguridad y privacidad](#14-seguridad-y-privacidad)
15. [Arquitectura técnica y despliegue](#15-arquitectura-técnica-y-despliegue)
16. [Operación diaria](#16-operación-diaria)
17. [Rutas de la API](#17-rutas-de-la-api)
18. [Límites conocidos y siguientes pasos](#18-límites-conocidos-y-siguientes-pasos)

---

## 1. Panorama general

**La idea:** la persona usa LocalizaT desde el navegador de su celular o computadora, y también puede instalarla como app. Todo pasa por un solo servidor con HTTPS. Una parte responde al momento (la API) y otra trabaja en segundo plano (el *worker*): compara reportes, manda avisos y envía correos.

```mermaid
flowchart LR
    subgraph Personas
        P1["Persona que perdió algo"]
        P2["Persona que encontró algo"]
        EQ["Equipo de LocalizaT"]
        PR["Punto de resguardo"]
    end

    subgraph Servidor["Servidor Contabo · Docker"]
        CADDY["Caddy<br/>HTTPS + frontend"]
        API["API Django<br/>(gunicorn)"]
        WORKER["Worker<br/>coincidencias · push · correo"]
        FOTOS[("Fotos privadas<br/>volumen Docker")]
    end

    DB[("Neon<br/>PostgreSQL")]

    subgraph Externos["Servicios externos"]
        GOOGLE["Google<br/>inicio de sesión"]
        GMAIL["Gmail SMTP<br/>correos"]
        PUSH["Servicios push<br/>del navegador"]
        CARTO["CARTO<br/>mapa base"]
        AWS["AWS Terrain Tiles<br/>relieve"]
        SENTRY["Sentry<br/>errores (opcional)"]
        UPTIME["UptimeRobot<br/>¿sigue vivo?"]
    end

    P1 & P2 & EQ & PR -->|navegador / app instalada| CADDY
    CADDY -->|/api /admin /static| API
    API --> DB
    WORKER --> DB
    API --> FOTOS
    API -.verifica token.-> GOOGLE
    WORKER --> GMAIL
    WORKER --> PUSH
    CADDY -.el navegador pide mosaicos.-> CARTO
    CADDY -.el navegador pide relieve.-> AWS
    API -.errores.-> SENTRY
    UPTIME -->|cada 5 min /api/health/| CADDY
```

| Pieza | Qué hace | Tecnología |
|---|---|---|
| **Frontend** | Las pantallas: inicio, explorar, reportar, Mi espacio, panel del equipo. Funciona como app instalable (PWA). | React 19 + TypeScript + Vite |
| **Caddy** | Sirve el frontend, saca el certificado HTTPS solo y reenvía `/api`, `/admin` y `/static` a Django. | Caddy 2 |
| **API** | Reglas del negocio: cuentas, reportes, avisos, reclamaciones, custodia, permisos. | Django 5.2 + Django REST Framework |
| **Worker** | Trabajo en segundo plano: compara reportes, envía push y correos, y deja un «latido» cada 30 s. | Comando de Django `run_matching_worker` |
| **Base de datos** | La única fuente de verdad. | PostgreSQL en Neon |
| **IA de coincidencias** | Modelo de lenguaje que corre en el propio servidor (no se manda texto a terceros). | fastembed · `paraphrase-multilingual-MiniLM-L12-v2` |

---

## 2. Quién usa LocalizaT (actores y casos de uso)

**La idea:** hay cuatro tipos de personas y un actor automático (el worker). Cada una puede hacer cosas distintas; el sistema revisa los permisos en el servidor, no solo en la pantalla.

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Visitante** | Cualquiera, sin cuenta. | Ver avisos públicos y el mapa, denunciar un aviso, dejar un comentario. |
| **Persona con cuenta** | Quien perdió o encontró algo. | Todo lo anterior, más reportar, subir fotos, publicar avisos, ver coincidencias, reclamar y confirmar una entrega. |
| **Equipo** (`is_staff`) | Personas de LocalizaT. | Moderar avisos y denuncias, decidir reclamaciones, ver métricas y comentarios. |
| **Punto de resguardo** | Una tienda, escuela o institución participante. | Recibir objetos en custodia e iniciar entregas de lo que tiene. |
| **Worker** | Proceso automático. | Comparar reportes y enviar avisos push y correos. |

### Casos de uso de la comunidad

```mermaid
flowchart LR
    V(["👤 Visitante"])
    U(["👤 Persona con cuenta"])

    subgraph LocalizaT["LocalizaT · lo que hace la comunidad"]
        UC1(["Explorar avisos y mapa"])
        UC2(["Denunciar un aviso"])
        UC3(["Dejar un comentario"])
        UC4(["Crear cuenta / entrar<br/>(correo o Google)"])
        UC5(["Reportar pérdida o hallazgo"])
        UC6(["Agregar fotos privadas"])
        UC7(["Publicar aviso<br/>básico o detallado"])
        UC8(["Ver posibles coincidencias"])
        UC9(["Solicitar devolución<br/>con detalle secreto"])
        UC10(["Confirmar que recibí el objeto"])
        UC11(["Recibir avisos<br/>bandeja · push · correo"])
        UC12(["Recuperar contraseña"])
        UC13(["Guardar reporte sin señal"])
    end

    V --- UC1
    V --- UC2
    V --- UC3
    V --- UC4
    V --- UC12
    U --- UC1
    U --- UC5
    U --- UC6
    U --- UC7
    U --- UC8
    U --- UC9
    U --- UC10
    U --- UC11
    UC5 -.incluye.-> UC13
    UC9 -.requiere.-> UC8
```

### Casos de uso del equipo y de los puntos

```mermaid
flowchart LR
    E(["🛡️ Equipo"])
    PT(["🏪 Punto de resguardo"])
    W(["⚙️ Worker"])

    subgraph Operacion["LocalizaT · operación"]
        O1(["Revisar avisos detallados"])
        O2(["Resolver denuncias"])
        O3(["Revisar coincidencias sugeridas"])
        O4(["Decidir reclamaciones<br/>comparando detalle secreto y fotos"])
        O5(["Recibir objeto en custodia"])
        O6(["Trasladar entre puntos"])
        O7(["Iniciar entrega"])
        O8(["Ver resumen y métricas"])
        O9(["Leer comentarios de la gente"])
        O10(["Comparar reportes con IA"])
        O11(["Enviar push y correos"])
    end

    E --- O1
    E --- O2
    E --- O3
    E --- O4
    E --- O6
    E --- O7
    E --- O8
    E --- O9
    PT --- O5
    PT --- O7
    W --- O10
    W --- O11
```

---

## 3. El viaje de un objeto, de la pérdida a la devolución

**La idea:** el sistema tiene dos mitades (como el logo, dos aros enlazados). Una persona reporta lo que perdió y otra lo que encontró. La IA las acerca, pero la devolución solo ocurre cuando el equipo comprobó que el objeto es de quien lo reclama.

```mermaid
flowchart TD
    A["Ana pierde su celular"] --> B["Ana reporta la pérdida<br/>+ detalle secreto (privado)"]
    C["Beto encuentra un celular"] --> D["Beto reporta el hallazgo<br/>y publica un aviso"]
    B --> M{{"Worker compara<br/>categoría · fechas · zona · descripción"}}
    D --> M
    M -->|parecido suficiente| S["Posible coincidencia"]
    M -->|no se parecen| N["Nada que avisar"]
    S --> AV["Ana recibe aviso<br/>bandeja · push · correo"]
    AV --> R["Ana solicita la devolución<br/>escribe un detalle que solo ella sabe"]
    R --> V{"El equipo compara<br/>detalle secreto + fotos"}
    V -->|coincide| OK["Reclamación aprobada<br/>el hallazgo sale del catálogo"]
    V -->|no coincide| NO["Rechazada<br/>Ana ve el motivo"]
    V -->|dudas| DIS["En disputa<br/>se revisa con más cuidado"]
    OK --> ENT["El equipo o el punto<br/>inicia la entrega"]
    ENT --> CONF["Ana confirma en la app<br/>que recibió el objeto"]
    CONF --> FIN["✓ Objeto devuelto<br/>los dos casos se cierran"]
```

**Puntos clave**
- La coincidencia **nunca** confirma quién es el dueño: solo sugiere revisar.
- El **detalle secreto** de la pérdida nunca se publica. Solo lo ve el equipo al decidir una reclamación.
- Un objeto puede quedarse con quien lo encontró o pasar a un **punto de resguardo** (con folio e historial de custodia).

---

## 4. Crear un reporte (con o sin señal)

**La idea:** son tres pasos.
1. **Qué pasó:** perdí o encontré, y el tipo de objeto.
2. **Cómo es:** descripción, lugar, fecha, detalle secreto y fotos opcionales.
3. **Qué verá la comunidad:** aviso básico, aviso con mis palabras o nada.

Mientras se escribe, se guarda un borrador en el celular, **sin el detalle secreto**. Si no hay señal al final, la persona puede dejarlo listo para que se envíe solo después.

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant F as App (navegador)
    participant C as Cola local<br/>(este celular)
    participant A as API Django
    participant DB as PostgreSQL
    participant W as Worker

    P->>F: Llena los 3 pasos
    F->>F: Guarda borrador (sin detalle secreto)
    P->>F: «Guardar mi reporte»
    F->>A: POST /api/reports/ (client_request_id)
    alt Hay señal
        A->>DB: Crea Report + ReportPrivate (detalle secreto)
        A->>DB: Crea MatchingJob (en espera)
        A-->>F: 201 Reporte con folio
        opt Eligió fotos
            F->>F: Reduce cada foto (~1600 px)
            F->>A: POST /api/reports/{id}/photos/
            A->>A: Valida, quita GPS/EXIF, recodifica JPEG
        end
        opt Eligió aviso
            F->>A: POST /api/reports/{id}/publication/
        end
        W->>DB: Toma el MatchingJob y compara
    else Sin señal
        F-->>P: «¿Lo dejamos listo para enviarse?»
        P->>F: «Guardar para enviar después»
        F->>C: Guarda el reporte (con permiso explícito)
        Note over F,C: Al volver la señal y con la app abierta…
        F->>A: POST /api/reports/ (mismo client_request_id)
        A-->>F: 201, o 200 si ya existía
        F->>C: Lo borra del celular
        F-->>P: «Volvió la señal: enviamos tu reporte LT-…»
    end
```

**Detalles técnicos**
- **Idempotencia:** cada reporte lleva un `client_request_id` (UUID) único por persona. Si se reenvía, el servidor devuelve el mismo reporte en lugar de duplicarlo.
- **Validaciones:** descripción de al menos 12 letras, fecha no futura, y detalle secreto obligatorio solo en pérdidas.
- **Fotos:** hasta 3 por reporte y 8 MB cada una. Se aceptan JPG, PNG, WEBP y GIF, y se rechazan las imágenes «bomba» de más de 40 megapíxeles. Se guardan **fuera** de cualquier carpeta pública.
- **Límite:** 20 reportes por hora por cuenta.

---

## 5. El motor de coincidencias (la IA)

**La idea:** cada vez que llega un reporte, el worker busca reportes «del otro lado» (si es pérdida, busca hallazgos) que sean del mismo tipo y de fechas cercanas. Luego mide qué tanto se parecen las descripciones, **aunque estén escritas con otras palabras** («chamarra de mezclilla» y «chaqueta de jean»). Solo si se parecen lo suficiente se crea una sugerencia.

```mermaid
flowchart TD
    N["Llega un reporte nuevo"] --> Q["MatchingJob en espera"]
    Q --> W["Worker lo toma<br/>(uno a la vez, con bloqueo)"]
    W --> F1{"Candidatos:<br/>tipo contrario · misma categoría ·<br/>±14 días · activos · otra cuenta"}
    F1 -->|hasta 500| T["Normaliza el texto:<br/>sin acentos · plurales · diminutivos ·<br/>palabras de la región"]
    T --> L["Similitud de palabras<br/>(palabras en común)"]
    T --> E["Similitud del modelo de lenguaje<br/>(vectores en el servidor)"]
    L --> AVG["Promedio de ambas"]
    E --> AVG
    AVG --> G{"¿Descripción ≥ 0.35?"}
    G -->|no| X["Se descarta"]
    G -->|sí| SC["Puntaje =<br/>30 base<br/>+ hasta 15 por cercanía de fechas<br/>+ hasta 40 por descripción<br/>+ 15 si la zona coincide"]
    SC --> TH{"¿Puntaje ≥ 55?"}
    TH -->|no| X
    TH -->|sí| SUG["MatchSuggestion<br/>con motivos legibles"]
    SUG --> NOTI["Aviso a la otra persona<br/>(si su contraparte es pública)"]
```

| Concepto | Valor | Por qué |
|---|---|---|
| Ventana de fechas | ±14 días | Un objeto encontrado meses después rara vez es el mismo. |
| Puerta de descripción | 0.35 | Así la fecha y la zona **solas** no bastan para sugerir. |
| Umbral para sugerir | 55 de 100 | Medido con casos de prueba: bajó las falsas alarmas de 54 a 3. |
| Palabras de la región | `REGIONAL_WORDS` en `matching/scoring.py` | «morral» = «bolsa», «cachucha» = «gorra», «mercado» = «plaza»… Se puede ampliar con lo que diga la comunidad. |
| Respaldo | Motor de reglas | Si el modelo no está disponible, compara solo con palabras y el servicio no se detiene. |

**Qué ve cada quien.** La persona solo ve la sugerencia si la contraparte es un **aviso público y activo**, con los datos públicos y nada privado. El equipo ve todas en el panel y puede descartarlas.

**Medir con casos reales:** `export_matching_cases` arma un archivo con las devoluciones aprobadas y `evaluate_matching` mide aciertos, primer lugar y falsas alarmas. Ver la [sección 16](#16-operación-diaria).

---

## 6. Avisos públicos, moderación y denuncias

**La idea:** un reporte es **privado** hasta que su dueño decida mostrarlo. Hay dos tipos de aviso:
- **Básico (al momento):** el sistema escribe el texto («Se busca: celular · Zongolica»), sin datos personales.
- **Con mis palabras:** lo escribe la persona y **el equipo lo revisa** antes de mostrarlo.

Si la comunidad denuncia un aviso varias veces, sale solo del catálogo hasta que el equipo decida.

```mermaid
flowchart TD
    R["Reporte privado"] -->|aviso básico| PUB["Público al momento<br/>texto generado + municipio"]
    R -->|aviso con mis palabras| PEN["Pendiente de revisión"]
    PEN -->|equipo aprueba| PUB
    PEN -->|equipo pide cambios| REJ["Rechazado<br/>la persona ve el motivo"]
    PUB -->|el dueño lo retira| R
    PUB -->|equipo lo oculta| R
    PUB -->|alguien lo denuncia| D["Denuncia abierta"]
    D -->|"3 denuncias distintas"| AUTO["Sale del catálogo<br/>pasa a revisión"]
    D --> EQ{"Equipo revisa<br/>sección «Denuncias»"}
    AUTO --> EQ
    EQ -->|está bien| BACK["Se cierran las denuncias<br/>y vuelve a publicarse"]
    EQ -->|retirar| HIDE["Privado + motivo<br/>la persona puede corregirlo"]
```

**Reglas que protegen a la gente**
- Un aviso con texto libre no puede llevar correos, enlaces, teléfonos ni números largos: se valida en el servidor.
- Se permiten como máximo 5 avisos básicos al día por cuenta.
- **Denuncias:** se puede denunciar con o sin cuenta. Cada persona cuenta **una sola vez** por aviso: se guarda una huella cifrada de su conexión, nunca la IP. Hay un límite de 10 denuncias por hora.
- **Motivos de denuncia:** datos personales, falso o engañoso, ofensivo, publicidad u otro.

---

## 7. Reclamar, verificar y entregar

**La idea:** quien reconoce su objeto en un aviso pide la devolución escribiendo un detalle que no aparece en el aviso. El equipo lo compara con el **detalle secreto** que esa persona escribió al reportar la pérdida y con las **fotos privadas**. Si coincide, se coordina la entrega. La devolución solo cuenta como hecha cuando **quien recibe confirma** en la app.

```mermaid
sequenceDiagram
    autonumber
    actor A as Ana (reclama)
    actor B as Beto (encontró)
    actor E as Equipo
    actor PR as Punto de resguardo
    participant S as LocalizaT

    A->>S: Solicita devolución + detalle + (su reporte de pérdida)
    S-->>B: Aviso: «Solicitaron la devolución de tu hallazgo»
    E->>S: Abre la reclamación
    S-->>E: Detalle de Ana · su detalle secreto · descripciones · fotos · correos
    Note over E: Se registra que el equipo vio la evidencia
    alt Coincide
        E->>S: Aprobar + motivo
        S->>S: Hallazgo → «reservado» y sale del catálogo
        S-->>A: Aviso: «Aprobaron tu solicitud»
        S-->>B: Aviso: «Conserva el objeto, te indicaremos cómo entregarlo»
    else No coincide
        E->>S: Rechazar + motivo
        S-->>A: Aviso con la respuesta
    end
    opt El objeto está en un punto
        PR->>S: Recepción (folio) — antes, en cualquier momento
    end
    E->>S: Iniciar entrega (o el punto que lo tiene)
    S-->>A: «Confirma cuando tengas el objeto»
    A->>S: Confirmar que lo recibí
    S->>S: Hallazgo y pérdida → «entregado» · custodia liberada
    S-->>B: «La entrega fue confirmada»
```

**Protecciones**
- No puedes reclamar tu propio hallazgo y solo hay una reclamación por persona y objeto, con un máximo de 5 al día.
- Solo puede haber **una** reclamación aprobada por hallazgo. Lo garantiza la base de datos, con bloqueo de fila al decidir.
- Cada decisión, cada consulta de evidencia y cada movimiento de custodia queda en la **bitácora** (`AuditEvent`).

---

## 8. Avisos a las personas: bandeja, push y correo

**La idea:** cuando pasa algo importante (una coincidencia, una respuesta del equipo, una entrega), se crea una **novedad** en la bandeja de la persona, la campana. A partir de ahí salen copias automáticas:
- **Push** al celular, si lo activó.
- **Correo**, si su correo está confirmado y no apagó los avisos.

```mermaid
sequenceDiagram
    autonumber
    participant S as Suceso<br/>(coincidencia, decisión, entrega)
    participant N as Notification<br/>(bandeja)
    participant Q as Colas
    participant W as Worker
    participant P as Servicio push
    participant G as Gmail SMTP
    actor U as Persona

    S->>N: Crea novedad
    N->>Q: Señal: si es coincidencia → PushDelivery por dispositivo
    N->>Q: Señal: si el correo está verificado y con avisos → EmailDelivery
    Note over Q: Coincidencias: máximo 1 correo cada 30 min
    loop Cada ~3 segundos
        W->>Q: Toma el siguiente envío (sin bloquear a otros)
        W->>P: Push cifrado (VAPID)
        W->>G: Correo HTML + texto
    end
    alt Falla el envío
        W->>Q: Reintenta más tarde (2, 4, 8… min), hasta 3-4 intentos
    end
    P-->>U: Notificación en el celular
    G-->>U: Correo «Apareció algo parecido»
    U->>N: Abre la app y lo marca como leído
```

- Los correos de **un solo uso** (verificar y recuperar contraseña) se **borran de la base** en cuanto se envían.
- Sin servidor de correo configurado, el sistema funciona igual: los correos se escriben en el registro del worker.
- Remitente actual: `localizat.zongolica@gmail.com`, con contraseña de aplicación de Google. Límite: 500 correos al día.

---

## 9. Cuentas: registro, Google, verificación y recuperación

**La idea:** se puede entrar con **correo y contraseña** o con **Google**. Para mandar avisos por correo, el correo tiene que estar **confirmado**; así nadie llena de correos a otra persona escribiendo su dirección. Si alguien olvida su contraseña, recibe un enlace que sirve 2 horas y una sola vez.

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant F as App
    participant A as API
    participant G as Google
    participant W as Worker + Gmail

    rect rgb(238, 246, 184)
    Note over P,W: Registro con correo
    P->>F: Correo + contraseña
    F->>A: POST /api/auth/signup/
    A->>A: Valida contraseña · límite por IP
    A->>W: Encola «Confirma tu correo» (enlace con token)
    A-->>F: Sesión iniciada (correo sin verificar)
    W-->>P: Correo con enlace /verificar?uid&token
    P->>F: Abre el enlace
    F->>A: POST /api/auth/verify-email/
    A-->>F: Correo verificado ✓
    end

    rect rgb(220, 237, 239)
    Note over P,G: Continuar con Google
    P->>G: Elige su cuenta
    G-->>F: Token de identidad
    F->>A: POST /api/auth/google/
    A->>G: Verifica firma y destinatario del token
    A-->>F: Sesión iniciada (correo ya verificado por Google)
    end

    rect rgb(252, 240, 210)
    Note over P,W: Olvidé mi contraseña
    P->>F: Escribe su correo
    F->>A: POST /api/auth/password-reset/
    A-->>F: Siempre la misma respuesta (no revela si existe)
    A->>W: Si existe, encola el enlace (2 horas, un uso)
    P->>F: Abre /restablecer?uid&token y elige otra
    F->>A: POST /api/auth/password-reset/confirm/
    A-->>F: Contraseña cambiada · sesión iniciada
    end
```

**Límites de intentos.** Se cuentan en una caché compartida por todos los procesos.

| Acción | Límite |
|---|---|
| Entrar (por IP) | 20 intentos fallidos cada 15 min |
| Entrar (por correo) | 6 fallos cada 15 min: frena a quien intenta adivinar contraseñas |
| Crear cuenta (por IP) | 8 por hora |
| Recuperar contraseña | 6 por IP y 3 por correo, por hora |
| Reenviar verificación | 3 por hora |
| API en general | 120/min sin cuenta · 240/min con cuenta |

---

## 10. Estados de cada pieza

**La idea:** cada cosa del sistema (un reporte, una reclamación, un envío) pasa por estados claros. Solo se permiten ciertos cambios, y cada uno queda registrado.

### Reporte (`Report.status`)
```mermaid
stateDiagram-v2
    state "Activo" as active
    state "Reclamación aprobada" as reserved
    state "Entregado" as returned
    state "Cerrado por su dueño" as closed
    [*] --> active: se crea
    active --> reserved: el equipo aprueba una reclamación del hallazgo
    reserved --> returned: quien reclama confirma la recepción
    active --> returned: la pérdida vinculada se resuelve
    active --> closed: «Ya no necesito este reporte»
    returned --> [*]
    closed --> [*]
```

### Aviso público (`Report.publication_status`)
```mermaid
stateDiagram-v2
    state "Privado" as private
    state "Pendiente de revisión" as pending
    state "Publicado" as public
    state "Rechazado" as rejected
    [*] --> private
    private --> public: aviso básico
    private --> pending: aviso con mis palabras
    pending --> public: equipo aprueba
    pending --> rejected: equipo pide cambios
    rejected --> pending: la persona lo corrige
    public --> private: lo retira · lo oculta el equipo · se cierra
    public --> pending: 3 denuncias
    pending --> public: denuncias descartadas
```

### Reclamación (`Claim.status`) y entrega (`Handover.status`)
```mermaid
stateDiagram-v2
    state "Enviada" as submitted
    state "En disputa" as disputed
    state "Aprobada" as approved
    state "Rechazada" as rejected
    state "Entrega pendiente" as hpending
    state "Entrega confirmada" as hconfirmed
    [*] --> submitted
    submitted --> approved
    submitted --> rejected
    submitted --> disputed
    disputed --> approved
    disputed --> rejected
    approved --> hpending: equipo o punto inicia la entrega
    hpending --> hconfirmed: quien reclama confirma
    rejected --> [*]
    hconfirmed --> [*]
```

### Envíos (`EmailDelivery`, `PushDelivery`) y trabajos de comparación (`MatchingJob`)
```mermaid
stateDiagram-v2
    state "Pendiente" as pending
    state "En proceso" as sending
    state "Enviado" as sent
    state "Fallido" as failed
    [*] --> pending
    pending --> sending: el worker lo toma
    sending --> sent: el servidor lo aceptó
    sending --> pending: falló, reintenta más tarde
    sending --> failed: agotó los intentos
    sent --> [*]
    failed --> [*]
```

---

## 11. Modelo de datos

**La idea:** el centro es el **Reporte**. Sus datos privados (detalle secreto, fotos) viven en tablas aparte, para que nunca se cuelen en una respuesta pública.

```mermaid
erDiagram
    USER ||--o{ REPORT : "crea"
    USER ||--o{ CLAIM : "reclama"
    USER ||--o{ NOTIFICATION : "recibe"
    USER ||--o{ PUSH_SUBSCRIPTION : "activa en cada dispositivo"
    USER ||--o{ EMAIL_DELIVERY : "recibe correos"
    USER }o--o{ CUSTODY_POINT : "es miembro de"
    REPORT ||--|| REPORT_PRIVATE : "detalle secreto"
    REPORT ||--o{ REPORT_PHOTO : "fotos privadas"
    REPORT ||--o{ ABUSE_REPORT : "denuncias"
    REPORT ||--o| MATCHING_JOB : "comparación pendiente"
    REPORT ||--o| REPORT_EMBEDDING : "vector de la IA"
    REPORT ||--o{ MATCH_SUGGESTION : "como pérdida"
    REPORT ||--o{ MATCH_SUGGESTION : "como hallazgo"
    REPORT ||--o{ CLAIM : "hallazgo reclamado"
    REPORT ||--o| CUSTODY_RECORD : "dónde está"
    REPORT ||--o{ CUSTODY_EVENT : "historial"
    CLAIM ||--o| HANDOVER : "entrega"
    CUSTODY_POINT ||--o{ CUSTODY_RECORD : "resguarda"
    NOTIFICATION ||--o{ PUSH_DELIVERY : "push"
    NOTIFICATION ||--o{ EMAIL_DELIVERY : "correo"

    USER {
        int id
        string email "único, sirve para entrar"
        bool email_verified
        bool email_notifications
        bool is_staff "equipo"
    }
    REPORT {
        uuid id
        string folio "LT-XXXXXXXXXXXX"
        uuid client_request_id "evita duplicados"
        string kind "lost / found"
        string category "phone, bag, credential…"
        string description "privado"
        string approximate_area "privado"
        date occurred_on
        string holder "finder / point"
        string status
        string publication_status
        string public_summary "lo que ve la comunidad"
        string public_area
    }
    REPORT_PRIVATE {
        text ownership_clue "detalle secreto"
    }
    REPORT_PHOTO {
        uuid id
        file image "fuera de lo público, sin EXIF"
        int width
        int height
    }
    MATCH_SUGGESTION {
        int score "0-100, solo lo ve el equipo"
        json reasons "motivos legibles"
        string status "pending / dismissed"
    }
    CLAIM {
        text evidence "detalle de quien reclama"
        string status
        string decision_reason
    }
    HANDOVER {
        string status "pending / confirmed"
        datetime confirmed_at
    }
    ABUSE_REPORT {
        string reason
        string fingerprint "huella cifrada, no IP"
        string status "open / dismissed / actioned"
    }
    EMAIL_DELIVERY {
        string kind
        string status
        int attempts
    }
    CUSTODY_POINT {
        string name
        string public_area
        bool active
    }
    CUSTODY_RECORD {
        datetime released_at
    }
    CUSTODY_EVENT {
        string action "intake / transfer / handover"
        string note
    }
```

Además hay tablas de apoyo: `AuditEvent` (la bitácora de cada acción importante), `Feedback` (los comentarios de «¿Algo no se entendió?») y `localizat_cache` (los contadores de intentos y el latido del worker).

---

## 12. Mapa de la Sierra

**La idea:** el mapa muestra **cuántos avisos hay por municipio**, nunca dónde está un objeto ni una persona. Cada círculo se dibuja sobre la **cabecera municipal**, con coordenadas del INEGI.

```mermaid
flowchart LR
    API["/api/public/report-map/"] -->|conteos por municipio<br/>+ 11 cabeceras| APP["Mapa en el navegador<br/>(MapLibre)"]
    CARTO["CARTO<br/>mapa base sin nombres<br/>+ capa de nombres"] --> APP
    DEM["AWS Terrain Tiles<br/>elevación real"] -->|sombreado| APP
    DEM -->|terreno 3D| APP
    APP --> V3["Relieve 3D<br/>(computadora)"]
    APP --> V2["Plano con sombreado<br/>(celular: menos datos)"]
```

- **El anillo de cada círculo:** lima = encontrados, turquesa = se buscan. El tamaño crece con el número de avisos.
- **Contexto:** las 11 cabeceras aparecen siempre (las que no tienen avisos, como puntos pequeños con su nombre).
- **En el celular:** se mueve con dos dedos, para no atrapar el desplazamiento de la página. Respeta «reducir movimiento».
- La clave de CARTO viaja en cada mosaico; conviene limitarla al dominio en el panel de CARTO.

---

## 13. Panel del equipo y métricas

**La idea:** el equipo tiene una sola pantalla con todo lo que espera una decisión. Al entrar, se abre la sección que tiene trabajo pendiente.

| Sección | Para qué |
|---|---|
| **Avisos por revisar** | Aprobar o pedir cambios a los avisos con texto libre; ocultar avisos visibles. |
| **Reclamaciones** | Comparar el detalle de quien reclama con su detalle secreto, las descripciones y las fotos, y decidir. |
| **Coincidencias** | Ver los pares que sugirió la IA y descartar los que no tienen sentido. |
| **Denuncias** | Avisos que la gente reportó, con sus motivos. Dejarlos o retirarlos. |
| **Custodia** | Inventario de los puntos: recibir, trasladar e iniciar entregas. |
| **Comentarios** | Lo que la gente escribe en «¿Algo no se entendió?», con página, tipo de red y celular. |
| **Resumen** | Cifras del servicio y botón «Descargar cifras» (JSON). |

**Qué mide el Resumen** (solo conteos, nunca datos de una persona):
- reportes totales, pérdidas, hallazgos, de la semana y del mes;
- **objetos devueltos** y cuántos días tarda la mitad en volver;
- porcentaje de pérdidas que recibieron al menos una coincidencia;
- cuentas y cuántas tienen el correo verificado;
- reportes por semana, por categoría y por municipio;
- fallos por revisar (correos, comparaciones).

---

## 14. Seguridad y privacidad

**La idea:** se muestra lo mínimo y se protege lo demás. La regla de oro es que **nada privado puede llegar a una respuesta pública**, y eso se comprueba con pruebas automáticas.

| Dato | ¿Público? | ¿Quién lo ve? |
|---|---|---|
| Tipo de objeto, municipio, fecha y texto del aviso | Sí, si la persona publica | Todos |
| Descripción completa y zona exacta | No | La persona dueña y el equipo |
| **Detalle secreto** | **Nunca** | Solo el equipo, al decidir una reclamación (queda registrado) |
| **Fotos** | **Nunca** | La persona dueña y el equipo (cada vista del equipo queda registrada) |
| Correo | Nunca | El equipo, solo para coordinar una entrega aprobada |
| Denuncias | No | El equipo; de quien denuncia solo se guarda una huella cifrada |

**Medidas técnicas**
- **Conexión:** HTTPS siempre, con HSTS y cookies de sesión `Secure`, `HttpOnly` y `SameSite=Lax`. Protección CSRF en toda escritura.
- **Encabezados de seguridad:** `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y protección contra *clickjacking*.
- **Fotos:** se recodifican y pierden el EXIF, que incluye la ubicación GPS. Se entregan solo a través de Django, con `Cache-Control: private`.
- **Límites de intentos:** en cuentas, reportes, fotos, denuncias y comentarios ([sección 9](#9-cuentas-registro-google-verificación-y-recuperación)). Detrás de Caddy se lee la IP real (`NUM_PROXIES=1`).
- **Privacidad de la IA:** la descripción se compara **en el propio servidor**; no se envía a servicios externos.
- **Errores:** los del navegador llegan al equipo sin correo ni reportes. Sentry está configurado con `send_default_pii=False`.
- **Bitácora:** `AuditEvent` registra quién decidió qué y cuándo: publicaciones, reclamaciones, evidencia vista, custodia y denuncias.
- **Sin señal:** el borrador nunca guarda el detalle secreto. La cola de envío lo guarda **solo** si la persona lo acepta y lo borra al enviarse.

---

## 15. Arquitectura técnica y despliegue

```mermaid
flowchart TB
    subgraph Internet
        U["Navegadores<br/>celular · computadora"]
        DNS["DuckDNS<br/>localizat.duckdns.org → 80.190.72.3"]
    end

    subgraph VPS["Contabo Cloud VPS 4 · Ubuntu 24.04 · Docker Compose (compose.prod.yaml)"]
        subgraph caddy["contenedor caddy"]
            C1["Caddy :80 :443<br/>certificado Let's Encrypt automático"]
            C2["/srv · frontend compilado"]
        end
        subgraph api["contenedor api"]
            A1["migrate + createcachetable<br/>gunicorn · 2 procesos"]
        end
        subgraph worker["contenedor worker"]
            W1["run_matching_worker<br/>coincidencias · push · correo · latido"]
        end
        V1[("volumen matching_models<br/>modelo de IA ~220 MB")]
        V2[("volumen private_media<br/>fotos privadas")]
        V3[("volúmenes caddy_data / config<br/>certificados")]
        BK["deploy/respaldar.sh<br/>cron diario 3:30 · 14 días"]
    end

    NEON[("Neon PostgreSQL<br/>historial gratis: 6 h")]

    U --> DNS --> C1
    C1 --> C2
    C1 -->|/api /admin /static| A1
    A1 --> NEON
    W1 --> NEON
    A1 --- V1
    W1 --- V1
    A1 --- V2
    C1 --- V3
    BK -->|pg_dump| NEON
    BK -->|tar| V2
```

| Entorno | Cómo se levanta | Diferencias |
|---|---|---|
| **Desarrollo** | `docker compose up -d --build` (archivo `compose.yaml`) | PostgreSQL local en contenedor, Vite con recarga en vivo en `localhost:5173` y Django `runserver`. Los secretos están en `.env`. |
| **Producción** | `docker compose -f compose.prod.yaml up -d --build` | Neon, gunicorn, Caddy con HTTPS y volumen de fotos. Los secretos están en `.env.prod` (nunca en Git). |

**Variables importantes de `.env.prod`:** `DATABASE_URL`, `DJANGO_SECRET_KEY`, `DOMAIN`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `EMAIL_HOST` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `DEFAULT_FROM_EMAIL`, `VAPID_*` (push), `SENTRY_DSN` (opcional).

**Salud del sistema:** `GET /api/health/` responde `{"status": "ok", "worker": "ok"}`. Si la base no responde, da 503. Si el worker lleva más de 2 minutos sin latido, dice `"worker": "sin_latido"`. UptimeRobot vigila esa palabra.

---

## 16. Operación diaria

| Tarea | Comando o lugar |
|---|---|
| Publicar una versión nueva | `cd ~/LocalizaT && git pull && docker compose -f compose.prod.yaml up -d --build` |
| Ver si todo está vivo | `https://localizat.duckdns.org/api/health/` · `docker compose -f compose.prod.yaml ps` |
| Ver errores del worker o de correo | `docker compose -f compose.prod.yaml logs worker --tail 100` |
| Crear una cuenta del equipo | `docker compose -f compose.prod.yaml exec api python manage.py createsuperuser` |
| Registrar puntos de resguardo | `https://localizat.duckdns.org/admin` › Puntos de custodia |
| Respaldo manual | `sh deploy/respaldar.sh` |
| Restaurar | `sh deploy/restaurar.sh deploy/respaldos/base_FECHA.dump [fotos_FECHA.tar.gz]` |
| Volver a comparar todo tras cambiar la IA | `docker compose -f compose.prod.yaml exec worker python manage.py rematch_reports` |
| Medir la IA con casos reales | `exec worker python manage.py export_matching_cases --salida /tmp/casos_reales.json` y luego `evaluate_matching --cases /tmp/casos_reales.json --details` |
| Pruebas automáticas (desarrollo) | Backend: `TEST_DB_ENGINE=sqlite python manage.py test` (56 pruebas). Frontend: `npm test` y `npm run build`. |

---

## 17. Rutas de la API

<details>
<summary>Ver todas las rutas</summary>

| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| GET | `/api/health/` | Público | Salud de la base y del worker |
| GET | `/api/auth/csrf/` | Público | Token CSRF |
| POST | `/api/auth/signup/` · `/login/` · `/logout/` | Público / sesión | Cuenta con correo |
| POST | `/api/auth/google/` | Público | Entrar con Google |
| GET | `/api/auth/me/` · `/config/` | Público | Sesión actual · ID de cliente de Google |
| POST | `/api/auth/password-reset/` · `/password-reset/confirm/` | Público | Recuperar contraseña |
| POST | `/api/auth/verify-email/` · `/verify-email/resend/` | Público / sesión | Confirmar correo |
| POST | `/api/auth/preferences/` · `/api/auth/password/` | Sesión | Avisos por correo · cambiar contraseña |
| GET, POST | `/api/reports/` | Sesión | Mis reportes · crear reporte |
| GET | `/api/reports/{id}/` | Dueño | Detalle de mi reporte |
| POST | `/api/reports/{id}/close/` | Dueño | Cerrar mi reporte |
| POST, DELETE | `/api/reports/{id}/publication/` | Dueño | Publicar o retirar aviso |
| GET | `/api/reports/{id}/suggestions/` | Dueño | Posibles coincidencias |
| GET, POST | `/api/reports/{id}/photos/` | Dueño (ver: + equipo) | Fotos privadas |
| GET, DELETE | `/api/photos/{id}/` | Dueño / equipo | Ver o borrar una foto |
| GET | `/api/public/reports/` · `/{id}/` | Público | Catálogo de avisos |
| GET | `/api/public/report-map/` | Público | Conteos por municipio y cabeceras |
| POST | `/api/public/reports/{id}/abuse/` | Público | Denunciar un aviso |
| GET, POST | `/api/claims/` · `/api/claims/{id}/` | Sesión | Mis reclamaciones |
| POST | `/api/handovers/{id}/confirm/` | Quien reclama | Confirmar recepción |
| GET, POST | `/api/handovers/` | Equipo / punto | Iniciar y listar entregas |
| POST | `/api/custody/intake/` · `/transfer/` | Punto / equipo | Recibir y trasladar objetos |
| GET | `/api/custody/inventory/` · `/api/points/` | Punto / público | Inventario · puntos activos |
| GET, POST | `/api/notifications/` · `/{id}/read/` | Sesión | Bandeja de novedades |
| GET, POST, DELETE | `/api/push/config/` · `/api/push/subscriptions/` | Sesión | Avisos push |
| POST | `/api/feedback/` · `/api/client-errors/` | Público | Comentarios · errores del navegador |
| GET, POST | `/api/ops/publications/` · `/api/ops/reports/{id}/publication/` | Equipo | Moderación de avisos |
| GET, POST | `/api/ops/suggestions/` · `/{id}/review/` | Equipo | Coincidencias |
| POST | `/api/ops/claims/{id}/decision/` | Equipo | Decidir reclamación |
| GET, POST | `/api/ops/abuse/` · `/{id}/decision/` | Equipo | Denuncias |
| GET, POST | `/api/ops/feedback/` · `/{id}/resolve/` | Equipo | Comentarios |
| GET | `/api/ops/metrics/` | Equipo | Resumen y cifras |

</details>

---

## 18. Límites conocidos y siguientes pasos

Lo que el sistema **todavía no demuestra** (dicho con honestidad para el concurso):

1. **La precisión de la IA en campo.** Se midió con casos ficticios. Falta medir con devoluciones reales (`export_matching_cases`).
2. **Puntos de resguardo reales.** La función existe, pero aún no hay establecimientos comprometidos ni un protocolo de custodia firmado.
3. **Pruebas con personas de la Sierra.** La guía está lista en `docs/03_operacion/03_PRUEBA_CON_PERSONAS.md`; faltan las sesiones.
4. **Náhuatl.** La estructura está lista (`frontend/src/i18n.tsx`) y la hoja para el traductor también (`frontend/traduccion-nahuatl.csv`). El selector aparece cuando un hablante de la región traduzca las 28 frases.
5. **Correo con dominio propio.** Hoy sale de Gmail (500 correos al día). Con un dominio, por ejemplo `localizat.mx`, se puede usar Resend y un remitente propio.
6. **Envío sin señal.** Funciona con la app abierta; las fotos no se guardan en la cola.
7. **La entrega se confirma con la palabra de quien recibe**: no hay prueba física ni firma.
