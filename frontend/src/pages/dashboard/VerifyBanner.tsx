import { useState } from "react";
import { MailWarning } from "lucide-react";
import { api } from "../../api";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button } from "../../components/ui";

// Solo mandamos avisos a correos confirmados; aquí se explica por qué y se
// puede pedir el enlace otra vez.
export function VerifyBanner() {
  const { user, toast } = useApp();
  const { busy, run } = useAction();
  const [sent, setSent] = useState(false);
  if (!user || user.email_verified) return null;
  return (
    <div className="draft-banner verify-banner" role="status">
      <MailWarning size={20} aria-hidden="true" />
      <p>
        Confirma tu correo para que podamos avisarte cuando aparezca algo
        parecido. Te mandamos un enlace a <strong>{user.email}</strong>.
      </p>
      <Button
        variant="ghost"
        busy={busy}
        disabled={sent}
        onClick={() =>
          run(
            async () => {
              await api.resendVerification();
              setSent(true);
              toast("Te mandamos otro correo. Revisa también la carpeta de spam.");
            },
            { onError: (message) => toast(message, "error") },
          )
        }
      >
        {sent ? "Correo enviado" : "Reenviar correo"}
      </Button>
    </div>
  );
}
