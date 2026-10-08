import { useCallback, useEffect, useRef, useState } from "react";

// El vocabulario del dominio vive en domain.ts. Se reexporta aquí para que el
// código que ya importaba estas utilidades desde "../lib" siga funcionando.
// statusName conserva su nombre anterior; por dentro es domain.statusLabel.
export { categories, categoryName, statusLabel as statusName } from "./domain";

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.length === 10 ? value + "T12:00:00" : value));
// Respeta el ajuste «reducir movimiento» del teléfono o la computadora.
export function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Si el navegador cree que hay conexión. En la Sierra la señal va y viene.
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// Identificador aleatorio. crypto.randomUUID solo existe con HTTPS o localhost;
// al probar desde un celular por la red local (http://192.168…) se usa el respaldo.
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

// Fecha local en formato AAAA-MM-DD, la que esperan los campos de fecha y la API.
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const today = () => isoDate(new Date());
export const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
};
export function useLoad<T>(loader: () => Promise<T>, key = "") {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [result, setResult] = useState<{ key: string; value: T } | null>(null);
  const [loadKey, setLoadKey] = useState(key);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoadKey(key);
    setLoading(true);
    setError("");
    setErrorStatus(null);
    loaderRef
      .current()
      .then((result) => {
        if (active) setResult({ key, value: result });
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Ocurrió un error.",
          );
          setErrorStatus(
            caught instanceof Error &&
              "status" in caught &&
              typeof caught.status === "number"
              ? caught.status
              : null,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, version]);
  return {
    data: result?.key === key ? result.value : null,
    loading: loadKey !== key || loading,
    error: loadKey === key ? error : "",
    errorStatus: loadKey === key ? errorStatus : null,
    reload,
  };
}
