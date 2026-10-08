import { useCallback, useEffect, useRef, useState } from "react";

// Guarda un formulario en este navegador mientras se llena, para que una caída
// de señal, una recarga o el cierre de la pestaña no hagan perder lo escrito.
// Nunca guardes aquí datos que no deban quedar en un celular compartido.
export function useDraft<T extends object>(key: string, initial: () => T) {
  const initialRef = useRef(initial);
  const restoredRef = useRef(false);
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) {
        restoredRef.current = true;
        return { ...initial(), ...(JSON.parse(saved) as Partial<T>) };
      }
    } catch {
      /* Modo privado o almacenamiento lleno: se trabaja sin borrador. */
    }
    return initial();
  });
  const [restored, setRestored] = useState(restoredRef.current);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Sin almacenamiento disponible: el formulario sigue funcionando. */
    }
  }, [key, value]);
  const update = useCallback(
    (changes: Partial<T>) => setValue((current) => ({ ...current, ...changes })),
    [],
  );
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* Nada que borrar. */
    }
    setRestored(false);
    setValue(initialRef.current());
  }, [key]);
  return { value, update, restored, dismissRestored: () => setRestored(false), clear };
}
