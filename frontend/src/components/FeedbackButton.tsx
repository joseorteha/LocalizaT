import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircleQuestion, Send } from "lucide-react";
import { api, type FeedbackMood } from "../api";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { useT } from "../i18n";
import { Button, ErrorBox, Modal } from "./ui";

const MOODS: [FeedbackMood, string, string][] = [
  ["confused", "No entendí algo", "Una palabra, un paso o qué hacer después."],
  ["broken", "Algo no funcionó", "Un botón, una pantalla o un error."],
  ["idea", "Tengo una idea", "Algo que haría más fácil usar LocalizaT."],
  ["praise", "Me gustó", "Cuéntanos qué te sirvió."],
];

// «¿Algo no se entendió?»: la forma más rápida de saber dónde se atora la gente.
export function FeedbackButton({ variant = "footer" }: { variant?: "footer" | "floating" | "menu" }) {
  const floating = variant === "floating";
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<FeedbackMood>("confused");
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const location = useLocation();
  const t = useT();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get("message"));
    const connection =
      (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "";
    run(async () => {
      await api.sendFeedback(mood, message, location.pathname, connection);
      setOpen(false);
      toast("Gracias. Tu comentario ya le llegó al equipo.");
    });
  }
  return (
    <>
      <button
        type="button"
        className={floating ? "feedback-fab" : variant === "menu" ? "install-menu-button" : "footer-feedback"}
        onClick={() => setOpen(true)}
        aria-label={t("feedback.open")}
      >
        <MessageCircleQuestion size={variant === "footer" ? 16 : 20} aria-hidden="true" />
        <span>{t("feedback.open")}</span>
      </button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title="Cuéntanos qué pasó"
        description="Lo lee el equipo para mejorar LocalizaT. No escribas contraseñas ni datos de tu banco."
      >
        <form className="form-stack" onSubmit={submit}>
          <fieldset className="choice-cards">
            <legend>¿De qué se trata?</legend>
            {MOODS.map(([value, label, hint]) => (
              <label className="decision-option" key={value}>
                <input type="radio" name="mood" checked={mood === value} onChange={() => setMood(value)} />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            Tu comentario
            <textarea name="message" rows={4} required minLength={4} maxLength={600} placeholder="Ej.: no supe dónde ver si alguien encontró mi mochila" />
          </label>
          {error && <ErrorBox message={error} />}
          <Button type="submit" busy={busy}>
            <Send size={17} /> Enviar comentario
          </Button>
        </form>
      </Modal>
    </>
  );
}
