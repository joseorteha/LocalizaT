import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { api } from "../../api";
import { useApp } from "../../context";
import { currentPushSubscription, disablePush, enablePush, preparePushWorker, pushSupported } from "../../push";

export function PushSettings() {
  const { toast } = useApp();
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const config = await api.pushConfig();
        if (!active) return;
        setPublicKey(config.public_key);
        if (!config.enabled) {
          setHint("Los avisos push aún no están configurados en este entorno.");
          return;
        }
        if (!pushSupported()) {
          setHint("Este navegador necesita una conexión segura. En iPhone, abre LocalizaT desde la pantalla de inicio.");
          return;
        }
        await preparePushWorker();
        const subscription = await currentPushSubscription();
        const status = subscription ? await api.pushSubscriptionStatus(subscription.endpoint) : { subscribed: false };
        if (!active) return;
        setEnabled(status.subscribed);
        setAvailable(Notification.permission !== "denied");
        if (Notification.permission === "denied") setHint("El navegador bloqueó los avisos. Puedes cambiarlo en los permisos del sitio.");
      } catch {
        if (active) setHint("No pudimos preparar los avisos en este dispositivo. Recarga la página para reintentarlo.");
      } finally {
        if (active) setReady(true);
      }
    }
    void prepare();
    return () => { active = false; };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setHint("");
        toast("Dejaste de recibir avisos push en este dispositivo.");
      } else {
        await enablePush(publicKey);
        setEnabled(true);
        setHint("");
        toast("Activaste los avisos de posibles coincidencias en este dispositivo.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron configurar los avisos.";
      setHint(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="push-settings" aria-label="Avisos en este dispositivo">
      <div className="push-settings-icon"><BellRing size={22} aria-hidden="true" /></div>
      <div className="push-settings-copy">
        <span className="eyebrow">EN ESTE DISPOSITIVO</span>
        <h3>Avisos de coincidencia</h3>
        <p>Si detectamos un posible parecido con tu reporte, podemos avisarte en este dispositivo. Revisa el caso en Mi espacio antes de solicitar una devolución.</p>
      </div>
      <span className={`push-status ${enabled ? "is-active" : ""}`} aria-live="polite">{enabled ? "Activados" : ready ? "Desactivados" : "Preparando"}</span>
      <button className="btn btn-secondary" type="button" onClick={toggle} disabled={!ready || (!available && !enabled) || busy}>
        {busy ? "Guardando…" : !ready ? "Preparando…" : enabled ? "Desactivar en este dispositivo" : "Activar en este dispositivo"}
      </button>
      {hint && <p className="push-settings-hint" role="status">{hint}</p>}
    </section>
  );
}
