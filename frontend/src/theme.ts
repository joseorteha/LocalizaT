import { useCallback, useEffect, useState } from "react";

// Tema claro u oscuro. index.html aplica el tema antes de pintar (para evitar
// un destello); aquí se mantiene sincronizado y se guarda la elección.
export type Theme = "light" | "dark";
const KEY = "localizat:tema";
const COLORS: Record<Theme, string> = { light: "#0E4E5A", dark: "#061A1F" };

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());
  useEffect(() => apply(theme), [theme]);
  useEffect(() => {
    // Sin elección guardada, el tema sigue al del teléfono o la computadora.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (!savedTheme()) setTheme(systemTheme());
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* Sin almacenamiento: el cambio dura mientras la página esté abierta. */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}
