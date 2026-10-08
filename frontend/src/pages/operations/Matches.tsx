import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../../api";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { Button, EmptyState, ErrorBox } from "../../components/ui";

export function Matches() {
  const load = useLoad(api.reviewMatches);
  const { toast } = useApp();
  const [busy, setBusy] = useState<number | null>(null);
  async function dismiss(id: number) {
    setBusy(id);
    try {
      await api.dismissMatch(id);
      load.reload();
      toast("Sugerencia descartada.");
    } catch (caught) {
      toast(
        caught instanceof Error ? caught.message : "No se pudo descartar.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  }
  if (load.loading && !load.data)
    return (
      <p className="loading-message">Comparando la cola de coincidencias…</p>
    );
  if (load.error) return <ErrorBox message={load.error} retry={load.reload} />;
  if (!load.data?.length)
    return (
      <EmptyState
        title="No hay pares pendientes."
        text="Las coincidencias aparecerán cuando existan pérdidas y hallazgos compatibles."
      />
    );
  return (
    <div className="match-review-list">
      {load.data.map((item) => (
        <article className="surface" key={item.id}>
          <div className="match-comparison">
            {[item.lost_report, item.found_report].map((report) => (
              <div key={report.id}>
                <span className="tiny-label">
                  {report.kind === "lost" ? "PÉRDIDA" : "HALLAZGO"} ·{" "}
                  {report.folio}
                </span>
                <h3>{categoryName(report.category)}</h3>
                <p>{report.description}</p>
                <small>
                  {report.approximate_area} · {dateLabel(report.occurred_on)}
                </small>
              </div>
            ))}
          </div>
          <div className="match-review-footer">
            <div className="match-reasons">
              {item.reasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <Button
              variant="ghost"
              busy={busy === item.id}
              onClick={() => dismiss(item.id)}
            >
              <X size={16} />
              Descartar par
            </Button>
          </div>
          <p className="hint">
            La sugerencia conserva los datos para una revisión humana. No
            confirma ni autoriza una entrega.
          </p>
        </article>
      ))}
    </div>
  );
}
