import { useState, type FormEvent } from "react";
import type { PublicationResult, Report } from "../api";
import { api } from "../api";
import { suggestedSummary } from "../domain";
import { municipalities, publicRegion } from "../geography";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { Button, ErrorBox, Modal } from "./ui";
import { Globe2, ShieldCheck } from "lucide-react";

export function PublishDialog({
  report,
  open,
  onClose,
  onDone,
}: {
  report: Report;
  open: boolean;
  onClose: () => void;
  onDone: (result: PublicationResult) => void;
}) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [detailed, setDetailed] = useState(false);
  const [municipality, setMunicipality] = useState(
    municipalities.includes(report.public_area as (typeof municipalities)[number])
      ? report.public_area : "",
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    run(async () => {
      const result = detailed
        ? await api.publish(
            report.id,
            String(fields.get("summary")),
            String(fields.get("area")),
          )
        : await api.publishBasic(report.id, municipality);
      toast(detailed
        ? "Listo. El equipo revisará tu aviso detallado."
        : "Tu aviso básico ya se ve en la comunidad.");
      onDone(result);
      onClose();
    });
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
      title="Publicar un aviso"
      description="Puedes compartir un aviso básico ahora. Si añades texto o una zona más precisa, el equipo los revisará primero."
    >
      <div className="privacy-note">
        <ShieldCheck size={21} />
        <p>
          No escribas tu teléfono, tu dirección ni el detalle secreto. Así nadie
          puede hacerse pasar por la persona dueña.
        </p>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label className="checkbox-label">
          <input type="checkbox" checked={detailed} onChange={(event) => setDetailed(event.target.checked)} />
          Quiero añadir detalles al aviso
        </label>
        {!detailed && (
          <>
            <label>
              Municipio general del aviso (opcional)
              <select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
                <option value="">Toda la Sierra / no especificar</option>
                {municipalities.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <small>El punto del mapa es una referencia municipal, no la ubicación exacta del objeto.</small>
            </label>
            <p className="hint">
              Se publicará al momento: «{suggestedSummary(report.kind, report.category)}» · {municipality || publicRegion}.
            </p>
          </>
        )}
        {detailed && <>
        <label>
          ¿Qué dirá el aviso?
          <textarea
            name="summary"
            minLength={12}
            maxLength={160}
            rows={3}
            defaultValue={
              report.public_summary ||
              suggestedSummary(report.kind, report.category)
            }
            required
          />
          <small>
            Agrega algo general, como el color. Ej.: «Se busca: mochila azul».
          </small>
        </label>
        <label>
          ¿En qué zona?
          <input
            name="area"
            minLength={3}
            maxLength={80}
            defaultValue={
              report.public_area || report.approximate_area.slice(0, 80)
            }
            required
          />
          <small>Una zona general, no la dirección exacta.</small>
        </label>
        </>}
        {error && <ErrorBox message={error} />}
        <Button type="submit" busy={busy}>
          <Globe2 size={17} />
          {detailed ? "Enviar a revisión" : "Publicar aviso básico ahora"}
        </Button>
      </form>
    </Modal>
  );
}
