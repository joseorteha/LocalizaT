import { Mail } from "lucide-react";
import { api } from "../../api";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";

// Avisos por correo: llegan aunque la persona no abra la app (lo normal en la Sierra).
export function EmailSettings() {
  const { user, toast, updateUser } = useApp();
  const { busy, run } = useAction();
  if (!user) return null;
  const enabled = user.email_notifications;
  const hint = !user.email_verified
    ? "Primero confirma tu correo con el enlace que te enviamos (arriba puedes pedirlo otra vez)."
    : "";
  return (
    <section className="push-settings" aria-label="Avisos por correo">
      <div className="push-settings-icon"><Mail size={22} aria-hidden="true" /></div>
      <div className="push-settings-copy">
        <span className="eyebrow">POR CORREO</span>
        <h3>Avisos en {user.email}</h3>
        <p>Te escribimos si aparece algo parecido a tu reporte o si cambia una solicitud. Como mucho, un correo de coincidencias cada media hora.</p>
      </div>
      <span className={`push-status ${enabled && user.email_verified ? "is-active" : ""}`} aria-live="polite">
        {!user.email_verified ? "Falta confirmar" : enabled ? "Activados" : "Desactivados"}
      </span>
      <button
        className="btn btn-secondary"
        type="button"
        disabled={busy}
        onClick={() =>
          run(
            async () => {
              const result = await api.setEmailNotifications(!enabled);
              updateUser(result.user);
              toast(enabled ? "Ya no te mandaremos avisos por correo." : "Activaste los avisos por correo.");
            },
            { onError: (message) => toast(message, "error") },
          )
        }
      >
        {busy ? "Guardando…" : enabled ? "Desactivar avisos por correo" : "Activar avisos por correo"}
      </button>
      {hint && <p className="push-settings-hint" role="status">{hint}</p>}
    </section>
  );
}
