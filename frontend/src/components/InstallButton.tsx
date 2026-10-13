import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { useApp } from "../context";
import { useInstall } from "../pwa";
import { Button, Modal } from "./ui";

// «Instalar la app»: solo aparece si el navegador lo permite y aún no está instalada.
export function InstallButton({ variant = "menu" }: { variant?: "menu" | "card" | "footer" }) {
  const { mode, install } = useInstall();
  const { toast } = useApp();
  const [guide, setGuide] = useState(false);
  if (!mode) return null;
  async function start() {
    if (mode === "ios") {
      setGuide(true);
      return;
    }
    if (await install()) toast("¡Listo! LocalizaT ya está en tu pantalla de inicio.");
  }
  return (
    <>
      {variant === "card" ? (
        <div className="install-card">
          <img src="/icon-192.png" alt="" width={48} height={48} />
          <div>
            <strong>Instala LocalizaT en tu celular</strong>
            <span>Ábrela como app, recibe avisos y úsala aunque la señal sea mala.</span>
          </div>
          <Button variant="secondary" onClick={start}>
            <Download size={17} /> Instalar
          </Button>
        </div>
      ) : (
        <button type="button" className={variant === "footer" ? "footer-feedback" : "install-menu-button"} onClick={start}>
          <Download size={variant === "footer" ? 16 : 20} aria-hidden="true" />
          <span>Instalar la app</span>
        </button>
      )}
      <Modal
        open={guide}
        onOpenChange={setGuide}
        title="Instala LocalizaT en tu iPhone"
        description="En iPhone se instala desde Safari, en tres toques."
      >
        <ol className="install-steps">
          <li>
            <span className="install-step-icon"><Share size={20} /></span>
            <span>Toca el botón <strong>Compartir</strong>, abajo en Safari (el cuadro con la flecha hacia arriba).</span>
          </li>
          <li>
            <span className="install-step-icon"><SquarePlus size={20} /></span>
            <span>Baja un poco y elige <strong>Agregar a inicio</strong>.</span>
          </li>
          <li>
            <span className="install-step-icon"><img src="/icon-192.png" alt="" width={22} height={22} /></span>
            <span>Toca <strong>Agregar</strong>. LocalizaT aparecerá como una app más, y desde ahí podrás activar los avisos.</span>
          </li>
        </ol>
        <p className="hint">Si abriste el enlace desde WhatsApp o Facebook, primero ábrelo en Safari.</p>
        <Button onClick={() => setGuide(false)}>Entendido</Button>
      </Modal>
    </>
  );
}
