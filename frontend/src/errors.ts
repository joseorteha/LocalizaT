// Avisa al equipo de los errores de JavaScript que ven las personas, sin
// librerías pesadas (importa en celulares con 3G). Como máximo 5 por visita.
let sent = 0;
const seen = new Set<string>();

function report(message: string, stack = "") {
  if (sent >= 5 || !message || seen.has(message)) return;
  seen.add(message);
  sent += 1;
  const body = JSON.stringify({
    message: message.slice(0, 300),
    stack: stack.slice(0, 2000),
    page: window.location.pathname.slice(0, 120),
  });
  // sendBeacon no espera respuesta ni bloquea la página.
  try {
    if (navigator.sendBeacon?.("/api/client-errors/", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* sigue con fetch */
  }
  fetch("/api/client-errors/", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}

export function watchErrors() {
  window.addEventListener("error", (event) => {
    // Errores de extensiones o scripts externos llegan sin archivo: no son nuestros.
    if (!event.filename || !event.filename.startsWith(window.location.origin)) return;
    report(event.message, event.error instanceof Error ? (event.error.stack ?? "") : "");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    // Los fallos de red ya se le explican a la persona; no son errores del código.
    if (reason instanceof Error && /conectar|conexión/i.test(reason.message)) return;
    report(
      reason instanceof Error ? reason.message : String(reason).slice(0, 300),
      reason instanceof Error ? (reason.stack ?? "") : "",
    );
  });
}
