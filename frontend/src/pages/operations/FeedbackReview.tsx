import { Check, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button, EmptyState, ErrorBox } from "../../components/ui";

// Lo que la gente deja en «¿Algo no se entendió?»: la fuente más directa para
// las pruebas con personas de la Sierra.
export function FeedbackReview() {
  const load = useLoad(() => api.feedbackQueue());
  const { busy, run } = useAction();
  const { toast } = useApp();
  return (
    <>
      <div className="case-section-heading">
        <h2>Comentarios de las personas</h2>
        <button className="text-link" type="button" onClick={load.reload}>
          <RefreshCw size={17} /> Actualizar lista
        </button>
      </div>
      {load.loading && !load.data ? (
        <p className="loading-message">Cargando comentarios…</p>
      ) : load.error ? (
        <ErrorBox message={load.error} retry={load.reload} />
      ) : !load.data?.length ? (
        <EmptyState category="book" title="No hay comentarios nuevos." text="Lo que la gente escriba en «¿Algo no se entendió?» aparecerá aquí." />
      ) : (
        <div className="case-list">
          {load.data.map((item) => (
            <article className="ops-row" key={item.id}>
              <div>
                <span className="tiny-label">
                  {item.mood_label.toUpperCase()} · {dateLabel(item.created_at)}
                  {item.page && ` · ${item.page}`}
                  {item.connection && ` · RED ${item.connection.toUpperCase()}`}
                  {!item.has_account && " · SIN CUENTA"}
                </span>
                <p className="feedback-message">{item.message}</p>
                {item.device && <small className="feedback-device">{item.device}</small>}
              </div>
              <Button
                variant="secondary"
                busy={busy}
                onClick={() =>
                  run(async () => {
                    await api.resolveFeedback(item.id);
                    toast("Marcaste el comentario como atendido.");
                    load.reload();
                  })
                }
              >
                <Check size={16} /> Atendido
              </Button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
