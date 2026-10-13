import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { api, type AbuseReason } from "../api";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { Button, ErrorBox, Modal } from "./ui";

const REASONS: [AbuseReason, string, string][] = [
  ["personal", "Muestra datos personales", "Un teléfono, una dirección, un nombre completo…"],
  ["false", "Parece falso o engañoso", "No describe un objeto real o busca engañar."],
  ["offensive", "Es ofensivo o inapropiado", "Insultos, burlas o contenido que no debería estar."],
  ["spam", "Es publicidad o spam", "Vende algo o no tiene que ver con objetos perdidos."],
  ["other", "Otro motivo", "Cuéntanos qué pasa."],
];

// Cualquiera puede pedir que el equipo revise un aviso, con o sin cuenta.
export function AbuseButton({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AbuseReason>("personal");
  const [done, setDone] = useState(false);
  const { busy, error, setError, run } = useAction();
  const { toast } = useApp();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = String(new FormData(event.currentTarget).get("details") ?? "");
    run(async () => {
      const result = await api.reportAbuse(reportId, reason, details);
      setDone(true);
      setOpen(false);
      toast(result.already ? "Ya habíamos recibido tu denuncia. Gracias." : "Gracias. El equipo revisará este aviso.");
    });
  }
  return (
    <>
      <button
        type="button"
        className="text-link abuse-link"
        disabled={done}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Flag size={16} />
        {done ? "Denuncia enviada" : "Denunciar este aviso"}
      </button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title="Denunciar este aviso"
        description="El equipo lo revisa. Si varias personas lo denuncian, el aviso deja de verse mientras tanto."
      >
        <form className="form-stack" onSubmit={submit}>
          <fieldset className="choice-cards">
            <legend>¿Qué pasa con este aviso?</legend>
            {REASONS.map(([value, label, hint]) => (
              <label className="decision-option" key={value}>
                <input type="radio" name="reason" checked={reason === value} onChange={() => setReason(value)} />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            Detalles {reason === "other" ? "" : "(opcional)"}
            <textarea
              name="details"
              rows={3}
              maxLength={300}
              required={reason === "other"}
              minLength={reason === "other" ? 5 : undefined}
              placeholder="Lo que ayude al equipo a entender el problema"
            />
          </label>
          {error && <ErrorBox message={error} />}
          <Button type="submit" busy={busy} variant="danger">
            <Flag size={17} /> Enviar denuncia
          </Button>
        </form>
      </Modal>
    </>
  );
}
