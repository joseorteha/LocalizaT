import { useEffect, useRef, useState } from "react";
import { api } from "./api";

// Botón oficial "Continuar con Google" (Google Identity Services). Devuelve un
// token de identidad que el backend verifica en /api/auth/google/. Si el backend
// no tiene configurado el ID de cliente, el botón no se muestra.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar Google."));
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
}

export function GoogleButton({
  onToken,
  onError,
}: {
  onToken: (credential: string) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Guardamos los callbacks en refs para no re-inicializar Google en cada render.
  const tokenCb = useRef(onToken);
  tokenCb.current = onToken;
  const errorCb = useRef(onError);
  errorCb.current = onError;
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    let active = true;
    api
      .authConfig()
      .then((cfg) => {
        if (active) setClientId(cfg.google_client_id || "");
      })
      .catch(() => {
        /* Sin config: el botón simplemente no aparece. */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGsi()
      .then(() => {
        if (!active || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => {
            if (resp.credential) tokenCb.current(resp.credential);
          },
        });
        ref.current.innerHTML = "";
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          locale: "es-419",
        });
      })
      .catch(() => errorCb.current?.("No se pudo cargar el inicio con Google."));
    return () => {
      active = false;
    };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="google-signin">
      <div className="google-signin-sep">
        <span>o</span>
      </div>
      <div ref={ref} className="google-signin-btn" />
    </div>
  );
}
