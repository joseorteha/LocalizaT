import { api, APIError, NetworkError, type Report, type ReportInput } from "./api";

// Reportes que se escribieron sin señal. Se guardan en ESTE celular (con el
// detalle secreto, porque sin él no se puede enviar una pérdida) solo hasta que
// vuelva la conexión; la persona lo acepta explícitamente antes de guardarlo.
// Reenviar es seguro: client_request_id hace que el servidor no lo duplique.
const KEY = "localizat:pendientes";

export type QueuedReport = {
  input: ReportInput;
  publishMode: "basic" | "detailed" | "none";
  municipality: string;
  summary: string;
  publicArea: string;
  queuedAt: string;
};

function read(): QueuedReport[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function write(items: QueuedReport[]) {
  try {
    if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* Sin almacenamiento: no hay cola posible. */
  }
}

export const pendingReports = () => read();

export function queueReport(item: QueuedReport): boolean {
  const items = read().filter(
    (existing) => existing.input.client_request_id !== item.input.client_request_id,
  );
  items.push(item);
  write(items);
  return read().length === items.length;
}

let flushing = false;

// Intenta enviar todo lo pendiente. Devuelve los reportes que sí llegaron.
// Si no hay señal, lo deja para después; si el servidor rechaza un reporte
// (datos inválidos), lo quita y lo informa para que la persona lo rehaga.
export async function flushReports(): Promise<{ sent: Report[]; rejected: string[] }> {
  const result = { sent: [] as Report[], rejected: [] as string[] };
  if (flushing || !navigator.onLine) return result;
  flushing = true;
  try {
    for (const item of read()) {
      try {
        const report = await api.createReport(item.input);
        if (item.publishMode === "basic")
          await api.publishBasic(report.id, item.municipality).catch(() => {});
        else if (item.publishMode === "detailed")
          await api.publish(report.id, item.summary, item.publicArea).catch(() => {});
        result.sent.push(report);
        write(read().filter((other) => other.input.client_request_id !== item.input.client_request_id));
      } catch (caught) {
        if (caught instanceof NetworkError) break; // se volvió a ir la señal
        if (caught instanceof APIError && (caught.status === 401 || caught.status === 403)) break; // falta entrar
        if (caught instanceof APIError && caught.status === 429) break; // esperar
        result.rejected.push(caught instanceof Error ? caught.message : "No se pudo enviar.");
        write(read().filter((other) => other.input.client_request_id !== item.input.client_request_id));
      }
    }
  } finally {
    flushing = false;
  }
  return result;
}
