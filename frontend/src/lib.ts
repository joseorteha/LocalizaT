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
