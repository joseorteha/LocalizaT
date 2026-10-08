import { useRef, useState } from "react";

// Encapsula el patrón repetido de "enviar algo al servidor": marca ocupado,
// limpia el error, ejecuta la tarea y, pase lo que pase, libera el ocupado.
// La tarea incluye dentro sus efectos de éxito (avisos, recargas, cerrar
// diálogos); si el servidor falla, no se ejecutan y el error queda a la vista.
// Por defecto el mensaje de error se guarda en estado (para <ErrorBox>); con
// la opción onError se puede redirigir a un aviso (toast) en su lugar.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function run(
    task: () => Promise<void>,
    options: { onError?: (message: string) => void } = {},
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Ocurrió un error.";
      if (options.onError) options.onError(message);
      else setError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
