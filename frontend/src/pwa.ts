import { useEffect, useState } from "react";

// Instalar LocalizaT como app. En Android/Chrome el navegador avisa con
// «beforeinstallprompt» y podemos mostrar nuestro propio botón. En iPhone no
// existe ese aviso: hay que explicar «Compartir › Agregar a inicio».

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // nosotros decidimos cuándo mostrarlo
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// «android»: hay aviso del navegador · «ios»: se explica a mano · null: ya instalada o no se puede.
export function useInstall() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const mode: "android" | "ios" | null = isStandalone()
    ? null
    : deferred
      ? "android"
      : isIOS()
        ? "ios"
        : null;
  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome === "accepted";
  }
  return { mode, install };
}

// El service worker hace que la app se pueda instalar, que abra sin señal y que
// lleguen los avisos push. Se registra al cargar, en segundo plano.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sin service worker la app funciona igual, solo sin instalar ni push */
    });
  });
}
