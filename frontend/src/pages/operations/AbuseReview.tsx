import { useState, type FormEvent } from "react";
import { ArrowRight, Flag, RefreshCw } from "lucide-react";
import { api, type AbuseCase } from "../../api";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button, EmptyState, ErrorBox, Modal } from "../../components/ui";

export function AbuseReview() {
  const load = useLoad(() => api.abuseQueue());
  const [selected, setSelected] = useState<AbuseCase | null>(null);
  const [decision, setDecision] = useState<"dismiss" | "hide">("dismiss");
  const { busy, error, setError, run } = useAction();
  const { toast } = useApp();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    run(async () => {
      await api.decideAbuse(selected.report_id, decision, reason);
      toast(decision === "hide" ? "Retiraste el aviso y avisamos a la persona." : "El aviso se queda; cerraste las denuncias.");
      setSelected(null);
      load.reload();
    });
  }
  return (
    <>
      <div className="case-section-heading">
        <h2>Avisos denunciados</h2>
        <button className="text-link" type="button" onClick={load.reload}>
          <RefreshCw size={17} /> Actualizar lista
        </button>
      </div>
      <p className="hint">
        Con tres denuncias, un aviso sale solo del catálogo hasta que alguien del
        equipo decida. Revisa si muestra datos personales, si parece falso o si es
        ofensivo.
      </p>
      {load.loading && !load.data ? (
        <p className="loading-message">Cargando denuncias…</p>
      ) : load.error ? (
        <ErrorBox message={load.error} retry={load.reload} />
      ) : !load.data?.length ? (
        <EmptyState category="document" title="No hay denuncias por revisar." text="Cuando alguien denuncie un aviso público, aparecerá aquí con sus motivos." />
      ) : (
        <div className="case-list">
          {load.data.map((item) => (
            <article className="ops-row" key={item.report_id}>
              <div>
                <span className="tiny-label">
                  {item.kind === "lost" ? "PÉRDIDA" : "HALLAZGO"} · {categoryName(item.category)} ·{" "}
                  {item.open_count} {item.open_count === 1 ? "denuncia" : "denuncias"}
                  {item.publication_status === "pending" ? " · FUERA DEL CATÁLOGO" : ""}
                </span>
                <h3>{item.public_summary || "Aviso sin resumen"}</h3>
                <p>{item.reports.map((report) => report.reason_label).join(" · ")}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(item);
                  setDecision("dismiss");
                  setError("");
                }}
              >
                Revisar <ArrowRight size={16} />
              </Button>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
        title="Revisar denuncias"
        description="Si el aviso está bien, se queda (o vuelve) al catálogo. Si no, se retira y la persona ve tu mensaje."
      >
        {selected && (
          <form className="form-stack" onSubmit={submit}>
            <div className="private-evidence">
              <span className="tiny-label">AVISO PÚBLICO · {selected.folio}</span>
              <h3>{selected.public_summary}</h3>
              <p>{selected.public_area}</p>
            </div>
            <div>
              <span className="tiny-label">LO QUE ESCRIBIÓ EN PRIVADO (NO SE PUBLICA)</span>
              <p>{selected.description}</p>
            </div>
            <div>
              <span className="tiny-label">MOTIVOS DE LAS DENUNCIAS</span>
              <ul className="abuse-reasons">
                {selected.reports.map((report, index) => (
                  <li key={index}>
                    <Flag size={15} aria-hidden="true" /> <strong>{report.reason_label}</strong>
                    {report.details && <> — {report.details}</>}
                    <small> · {dateLabel(report.created_at)}</small>
                  </li>
                ))}
              </ul>
            </div>
            <fieldset className="choice-cards">
              <legend>Decisión</legend>
              <label className="decision-option">
                <input type="radio" name="decision" checked={decision === "dismiss"} onChange={() => setDecision("dismiss")} />
                <span>
                  <strong>El aviso está bien</strong>
                  <small>Se cierran las denuncias y el aviso sigue visible.</small>
                </span>
              </label>
              <label className="decision-option">
                <input type="radio" name="decision" checked={decision === "hide"} onChange={() => setDecision("hide")} />
                <span>
                  <strong>Retirar el aviso</strong>
                  <small>Sale del catálogo. La persona puede corregirlo y volver a publicarlo.</small>
                </span>
              </label>
            </fieldset>
            {decision === "hide" && (
              <label>
                Mensaje para la persona
                <textarea name="reason" rows={3} required minLength={5} maxLength={300} placeholder="Ej.: el aviso mostraba un número de teléfono" />
              </label>
            )}
            {error && <ErrorBox message={error} />}
            <Button type="submit" busy={busy} variant={decision === "hide" ? "danger" : "primary"}>
              Guardar decisión
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
