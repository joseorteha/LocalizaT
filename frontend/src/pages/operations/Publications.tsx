import { useState, type FormEvent } from "react";
import { ArrowRight, ClipboardCheck, RefreshCw } from "lucide-react";
import { api, type Publication } from "../../api";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button, EmptyState, ErrorBox, Modal } from "../../components/ui";

export function Publications() {
  const [visibility, setVisibility] = useState<"pending" | "public">("pending");
  const load = useLoad(() => api.publications(visibility), visibility);
  const [selected, setSelected] = useState<Publication | null>(null);
  const [decision, setDecision] = useState("approve");
  const { busy, error, setError, run } = useAction();
  const { toast } = useApp();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const reason = String(new FormData(event.currentTarget).get("reason"));
    run(async () => {
      await api.reviewPublication(selected.id, decision, reason);
      toast(decision === "hide" ? "El aviso se ocultó de la comunidad." : "La revisión del aviso quedó registrada.");
      setSelected(null);
      load.reload();
    });
  }
  return (
    <>
      <div className="case-section-heading">
        <h2>{visibility === "pending" ? "Avisos pendientes de revisión" : "Avisos visibles"}</h2>
        <button className="text-link" type="button" onClick={load.reload}>
          <RefreshCw size={17} /> Actualizar lista
        </button>
      </div>
      <div className="page-tabs">
        <button type="button" aria-pressed={visibility === "pending"} onClick={() => setVisibility("pending")}>Por revisar</button>
        <button type="button" aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>Visibles</button>
      </div>
      {load.loading && !load.data ? (
        <p className="loading-message">Cargando avisos…</p>
      ) : load.error ? (
        <ErrorBox message={load.error} retry={load.reload} />
      ) : !load.data?.length ? (
        <EmptyState
          category="book"
          title={visibility === "pending" ? "No hay avisos esperando." : "No hay avisos visibles."}
          text={visibility === "pending"
            ? "Los avisos con texto libre aparecerán aquí para revisión. Los básicos se publican al momento y están en la pestaña Visibles."
            : "Los avisos públicos aparecerán aquí para que el equipo pueda ocultarlos si hace falta."}
        />
      ) : (
        <div className="case-list">
          {load.data.map((item) => (
            <article className="ops-row" key={item.id}>
              <div>
                <span className="tiny-label">
                  {item.kind === "lost" ? "PÉRDIDA" : "HALLAZGO"} ·{" "}
                  {categoryName(item.category)}
                </span>
                <h3>{item.public_summary}</h3>
                <p>
                  {item.public_area} · {dateLabel(item.occurred_on)}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(item);
                  setError("");
                  setDecision(item.publication_status === "public" ? "hide" : "approve");
                }}
              >
                {item.publication_status === "public" ? "Ver y moderar" : "Revisar"}
                <ArrowRight size={16} />
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
        title="Revisar aviso"
        description={selected?.publication_status === "public"
          ? "Oculta el aviso si incumple las reglas o supone un riesgo. La persona dueña verá el motivo."
          : "Apruébalo solo si no muestra teléfonos, direcciones ni detalles que ayuden a alguien a hacerse pasar por la persona dueña."}
      >
        {selected && (
          <form className="form-stack" onSubmit={submit}>
            <div className="private-evidence">
              <span className="tiny-label">AVISO PARA LA COMUNIDAD</span>
              <h3>{selected.public_summary}</h3>
              <p>{selected.public_area}</p>
            </div>
            <div>
              <span className="tiny-label">
                LO QUE ESCRIBIÓ EN PRIVADO (NO SE PUBLICA)
              </span>
              <p>{selected.description}</p>
            </div>
            <label>
              Decisión
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
              >
                {selected.publication_status === "public" ? (
                  <option value="hide">Ocultar de la comunidad</option>
                ) : (
                  <>
                    <option value="approve">Aprobar y mostrar a la comunidad</option>
                    <option value="reject">Pedir un cambio a la persona</option>
                  </>
                )}
              </select>
            </label>
            <label>
              Mensaje para la persona
              <textarea
                name="reason"
                rows={3}
                required
                minLength={5}
                maxLength={300}
                placeholder={
                  decision === "approve"
                    ? "Ej.: tu aviso ya está visible"
                    : decision === "hide"
                      ? "Ej.: este aviso contiene información que debe retirarse"
                      : "Ej.: quita el número de teléfono del aviso"
                }
              />
            </label>
            {error && <ErrorBox message={error} />}
            <Button type="submit" busy={busy}>
              <ClipboardCheck size={18} />
              Guardar revisión
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
