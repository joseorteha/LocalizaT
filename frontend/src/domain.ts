// El vocabulario del dominio, separado por mundo, igual que los TextChoices del
// backend (reports/models.py, claims/models.py, custody/models.py). Cada mapa
// traduce un valor del backend a su etiqueta en español. Mantener estos mapas
// aquí evita el diccionario revuelto que mezclaba estados de distintos mundos.

export type Kind = "lost" | "found";
export const KIND: Record<Kind, string> = {
  lost: "Perdí algo",
  found: "Encontré algo",
};

export type Category = "bag" | "clothing" | "accessory" | "book" | "other";
export const CATEGORY: Record<Category, string> = {
  bag: "Bolsas y mochilas",
  clothing: "Ropa",
  accessory: "Accesorios",
  book: "Libros y cuadernos",
  other: "Otros objetos",
};
// Lista para los selectores de categoría (orden de aparición en la interfaz).
export const categories = (Object.keys(CATEGORY) as Category[]).map(
  (value) => ({
    value,
    label: CATEGORY[value],
  }),
);

// Estado del objeto a lo largo de su camino (Report.Status en el backend).
export type ReportStatus = "active" | "reserved" | "returned" | "closed";
export const REPORT_STATUS: Record<ReportStatus, string> = {
  active: "Activo",
  reserved: "En verificación de entrega",
  returned: "Devuelto",
  closed: "Cerrado",
};

// Visibilidad del aviso (Report.Publication en el backend).
export type Publication = "private" | "pending" | "public" | "rejected";
export const PUBLICATION: Record<Publication, string> = {
  private: "Privado",
  pending: "Pendiente de revisión",
  public: "Publicado",
  rejected: "Rechazado",
};

// Estado de una reclamación de propiedad (Claim.Status en el backend).
export type ClaimStatus = "submitted" | "approved" | "rejected" | "disputed";
export const CLAIM_STATUS: Record<ClaimStatus, string> = {
  submitted: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  disputed: "En disputa",
};

// Estado de una entrega (Handover.Status en el backend).
export type HandoverStatus = "pending" | "confirmed";
export const HANDOVER_STATUS: Record<HandoverStatus, string> = {
  pending: "Entrega iniciada",
  confirmed: "Entrega confirmada",
};

export const categoryName = (value: string) =>
  CATEGORY[value as Category] ?? "Objeto";

// Nombre en singular para frases como "Se busca: mochila o bolsa".
const CATEGORY_ONE: Record<Category, string> = {
  bag: "mochila o bolsa",
  clothing: "prenda de ropa",
  accessory: "accesorio",
  book: "libro o cuaderno",
  other: "objeto",
};

// Ejemplo de descripción según lo que se eligió, para orientar sin confundir.
const DESCRIPTION_EXAMPLE: Record<Category, string> = {
  bag: "Ej.: mochila azul con cierre gris",
  clothing: "Ej.: sudadera gris con capucha, talla mediana",
  accessory: "Ej.: lentes de armazón negro en estuche café",
  book: "Ej.: cuaderno verde de rayas con forro de plástico",
  other: "Ej.: termo metálico rojo con tapa negra",
};
export const descriptionExample = (category: string) =>
  DESCRIPTION_EXAMPLE[category as Category] ?? DESCRIPTION_EXAMPLE.other;

// Un primer resumen público que la persona puede completar (p. ej. con el
// color). No usa la descripción privada, que puede tener detalles secretos.
export const suggestedSummary = (kind: string, category: string) =>
  `${kind === "lost" ? "Se busca" : "Se encontró"}: ${CATEGORY_ONE[category as Category] ?? "objeto"}`;

export const kindName = (value: string) => KIND[value as Kind] ?? value;

export type StatusDomain = "report" | "publication" | "claim" | "handover";
const STATUS_LABELS: Record<StatusDomain, Record<string, string>> = {
  report: REPORT_STATUS,
  publication: PUBLICATION,
  claim: CLAIM_STATUS,
  handover: HANDOVER_STATUS,
};
export const statusLabel = (value: string, domain: StatusDomain = "report") =>
  STATUS_LABELS[domain][value] ?? value;

// ---------------------------------------------------------------------------
// "¿Qué sigue?" — traduce los estados técnicos a pasos y frases sencillas.
// Las pantallas no deben combinar estados por su cuenta: usan estas funciones
// para que el mismo caso se explique igual en todas partes.
// ---------------------------------------------------------------------------

export type StepState = "done" | "current" | "todo";
export type CaseStep = { label: string; state: StepState };
// ok: algo bueno pasó · wait: el equipo o la comunidad tienen el turno ·
// action: la persona tiene que hacer algo · closed: ya no avanza.
export type Tone = "ok" | "wait" | "action" | "closed";
export type CaseProgress = {
  steps: CaseStep[];
  short: string;
  next: string;
  tone: Tone;
  action?: "publish" | "matches" | "claim" | "explore";
};

type ReportLike = {
  kind: string;
  status: string;
  publication_status: string;
  match_count?: number;
  holder?: string;
};
type ClaimLike = {
  status: string;
  handover: { status: string } | null;
} | null;

function withStage(labels: string[], stage: number): CaseStep[] {
  return labels.map((label, index) => ({
    label,
    state: index < stage ? "done" : index === stage ? "current" : "todo",
  }));
}

// Un reporte cerrado solo cumplió su primer paso.
const closedSteps = (labels: string[]): CaseStep[] =>
  labels.map((label, index) => ({
    label,
    state: index === 0 ? "done" : "todo",
  }));

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function publicationProgress(
  report: ReportLike,
  privateNext: string,
): Omit<CaseProgress, "steps"> | null {
  if (report.publication_status === "pending")
    return {
      short: "El equipo revisa tu aviso",
      next: `Tu reporte está guardado. El aviso aún no es público: espera la revisión del equipo. ${report.kind === "lost" ? "Puedes buscar en los objetos encontrados mientras tanto." : "Conserva el objeto mientras se revisa."} Las novedades aparecen en la campana; todavía no enviamos correo ni SMS.`,
      tone: "wait",
      action: report.kind === "lost" ? "explore" : undefined,
    };
  if (report.publication_status === "rejected")
    return {
      short: "Corrige tu aviso",
      next: "El equipo te pidió un cambio en tu aviso. Lee el motivo, corrígelo y vuelve a enviarlo.",
      tone: "action",
      action: "publish",
    };
  if (report.publication_status === "private")
    return {
      short: "Reporte privado",
      next: privateNext,
      tone: "action",
      action: report.kind === "lost" ? "explore" : "publish",
    };
  return null;
}

export function lostProgress(
  report: ReportLike,
  claim: ClaimLike = null,
): CaseProgress {
  const labels = [
    "Reporte guardado",
    "Buscar entre los hallazgos",
    "Revisar la propiedad",
    "Confirmar la recepción",
  ];
  const matches = report.match_count ?? 0;
  if (report.status === "returned")
    return {
      steps: withStage(labels, 4),
      short: "¡Lo recuperaste!",
      next: "Tu objeto volvió contigo. Este caso está cerrado.",
      tone: "ok",
    };
  if (report.status === "closed")
    return {
      steps: closedSteps(labels),
      short: "Cerrado",
      next: "Cerraste este reporte. Ya no aparece en los avisos.",
      tone: "closed",
    };
  if (claim?.handover?.status === "pending")
    return {
      steps: withStage(labels, 3),
      short: "Confirma que lo recibiste",
      next: "El equipo inició la entrega. Cuando tengas el objeto en tus manos, confirma que lo recibiste.",
      tone: "action",
      action: "claim",
    };
  if (claim?.status === "approved")
    return {
      steps: withStage(labels, 3),
      short: "Solicitud aprobada; falta la entrega",
      next: "El equipo aprobó tu solicitud. La entrega todavía no está confirmada: revisa la respuesta del equipo y espera la coordinación antes de ir a recogerlo.",
      tone: "ok",
      action: "claim",
    };
  if (claim?.status === "submitted" || claim?.status === "disputed")
    return {
      steps: withStage(labels, 2),
      short: "El equipo revisa tu solicitud",
      next: "Enviaste una solicitud de devolución. Revisa su estado y la respuesta del equipo antes de hacer otra solicitud o coordinar una entrega.",
      tone: "wait",
      action: "claim",
    };
  if (matches > 0)
    return {
      steps: withStage(labels, 1),
      short: `${plural(matches, "objeto parecido", "objetos parecidos")} — revísalo`,
      next: `Hay ${plural(matches, "hallazgo parecido", "hallazgos parecidos")} para revisar. Una coincidencia no confirma que sea tuyo. Abre el aviso y, si lo reconoces, solicita que el equipo revise tu propiedad.`,
      tone: "action",
      action: "matches",
    };
  const publication = publicationProgress(
    report,
    "Tu pérdida está registrada y se compara con los hallazgos aunque no publiques. Puedes compartir un aviso general para que más personas ayuden, o buscar en los objetos encontrados.",
  );
  if (publication) return { steps: withStage(labels, 1), ...publication };
  if (claim?.status === "rejected")
    return {
      steps: withStage(labels, 1),
      short: "Sigue buscando",
      next: "El equipo no pudo comprobar que el objeto que reclamaste era tuyo. Tu aviso sigue visible por si aparece otro.",
      tone: "wait",
      action: "explore",
    };
  return {
    steps: withStage(labels, 1),
    short: "Visible para la comunidad",
    next: "La comunidad ya puede ver tu aviso. También puedes buscar por tu cuenta entre los objetos encontrados. Vuelve a Mi espacio para revisar coincidencias y novedades; todavía no enviamos correo ni SMS.",
    tone: "wait",
    action: "explore",
  };
}

export function foundProgress(report: ReportLike): CaseProgress {
  const labels = [
    "Hallazgo guardado",
    "Buscar a la persona dueña",
    "Revisar la propiedad",
    "Confirmar la entrega",
  ];
  const matches = report.match_count ?? 0;
  if (report.status === "returned")
    return {
      steps: withStage(labels, 4),
      short: "Devuelto. ¡Gracias!",
      next: "El objeto ya volvió con su dueño. Gracias por ayudar.",
      tone: "ok",
    };
  if (report.status === "closed")
    return {
      steps: closedSteps(labels),
      short: "Cerrado",
      next: "Cerraste este reporte. Ya no aparece en los avisos.",
      tone: "closed",
    };
  if (report.status === "reserved")
    return {
      steps: withStage(labels, 3),
      short: "Solicitud aprobada; falta la entrega",
      next:
        report.holder === "point"
          ? "El objeto está registrado en un punto de resguardo. El equipo aprobó una solicitud y falta coordinar y confirmar la entrega."
          : "El equipo aprobó una solicitud. Conserva el objeto y espera la coordinación del equipo antes de entregarlo; la recepción aún no está confirmada.",
      tone: "ok",
    };
  const publication = publicationProgress(
    report,
    "Tu hallazgo está registrado. Si quieres que la persona dueña pueda reconocerlo, comparte un aviso general. No publiques el contenido ni las marcas privadas del objeto.",
  );
  if (publication) return { steps: withStage(labels, 1), ...publication };
  return {
    steps: withStage(labels, 1),
    short: "Visible para la comunidad",
    next:
      matches > 0
        ? `Hay ${plural(matches, "reporte de pérdida", "reportes de pérdida")} de algo parecido. Guarda el objeto: si alguien lo reclama, el equipo comprobará que sea suyo antes de entregarlo.`
        : "Guarda el objeto por ahora. Si alguien lo reclama, el equipo comprobará que sea suyo y te avisará.",
    tone: "wait",
  };
}

export function reportProgress(
  report: ReportLike,
  claim: ClaimLike = null,
): CaseProgress {
  return report.kind === "lost"
    ? lostProgress(report, claim)
    : foundProgress(report);
}

export function claimProgress(claim: NonNullable<ClaimLike>): CaseProgress {
  const labels = [
    "Solicitud enviada",
    "Revisar la propiedad",
    "Preparar la entrega",
    "Confirmar la recepción",
  ];
  if (claim.handover?.status === "confirmed")
    return {
      steps: withStage(labels, 4),
      short: "¡Lo recuperaste!",
      next: "Confirmaste que recibiste tu objeto. Este caso está cerrado.",
      tone: "ok",
    };
  if (claim.handover?.status === "pending")
    return {
      steps: withStage(labels, 3),
      short: "Confirma que lo recibiste",
      next: "El equipo inició la entrega. Confirma solo cuando tengas el objeto en tus manos.",
      tone: "action",
    };
  if (claim.status === "approved")
    return {
      steps: withStage(labels, 2),
      short: "Solicitud aprobada; falta la entrega",
      next: "El equipo aprobó tu solicitud. Revisa su respuesta y espera la coordinación antes de ir a recogerlo. Aprobar la solicitud no confirma la entrega.",
      tone: "ok",
    };
  if (claim.status === "rejected")
    return {
      steps: labels.map((label, index) => ({
        label,
        state: index < 2 ? "done" : "todo",
      })),
      short: "No se pudo comprobar",
      next: "El equipo no pudo comprobar que el objeto era tuyo. Lee su respuesta abajo.",
      tone: "closed",
    };
  return {
    steps: withStage(labels, 1),
    short:
      claim.status === "disputed" ? "Revisión más cuidadosa" : "En revisión",
    next:
      claim.status === "disputed"
        ? "El equipo necesita revisar con más cuidado. Lee su respuesta: puede indicar qué información falta. La entrega sigue detenida."
        : "El equipo revisará tu detalle privado. Puedes consultar esta solicitud en Mi espacio → Solicitudes de devolución. La respuesta aparecerá aquí y en Novedades.",
    tone: "wait",
  };
}

// Una solicitud rechazada más reciente no debe ocultar una entrega pendiente.
export function primaryClaim<T extends NonNullable<ClaimLike>>(
  claims: T[],
): T | null {
  const priority = (claim: T) =>
    claim.handover?.status === "confirmed"
      ? 0
      : claim.handover?.status === "pending"
        ? 1
        : claim.status === "approved"
          ? 2
          : claim.status === "submitted" || claim.status === "disputed"
            ? 3
            : 4;
  return claims.reduce<T | null>(
    (best, item) => (!best || priority(item) < priority(best) ? item : best),
    null,
  );
}
