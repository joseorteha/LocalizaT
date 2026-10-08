import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { api } from "../../api";
import { primaryClaim, reportProgress, type Tone } from "../../domain";
import { useApp } from "../../context";
import { categoryName, dateLabel, useLoad } from "../../lib";
import {
  EmptyState,
  ErrorBox,
  SkeletonCards,
  StatusPill,
} from "../../components/ui";
import { ObjectArt } from "../../components/Art";

const TONE_ORDER: Record<Tone, number> = { action: 0, wait: 1, ok: 2, closed: 3 };

export function MyReports() {
  const { user } = useApp();
  const load = useLoad(api.reports);
  // Las reclamaciones dicen en qué va una pérdida que ya reclamaste.
  const claims = useLoad(api.claims);
  if ((load.loading && !load.data) || (claims.loading && !claims.data))
    return <SkeletonCards />;
  if (load.error || claims.error)
    return (
      <ErrorBox
        message={load.error || claims.error}
        retry={() => {
          load.reload();
          claims.reload();
        }}
      />
    );
  if (!load.data?.length)
    return (
      <EmptyState
        title="Todavía no tienes reportes."
        text="Si perdiste o encontraste algo, cuéntanos qué pasó. Aquí verás cómo va tu caso."
      >
        <Link className="btn btn-primary" to="/reportar">
          <Plus size={17} />
          Hacer un reporte
        </Link>
      </EmptyState>
    );
  return (
    <section className="dashboard-section" aria-labelledby="reports-title">
      <div className="dashboard-section-head">
        <div>
          <span className="eyebrow">LO QUE REGISTRASTE</span>
          <h2 id="reports-title">Tus reportes</h2>
          <p>Abre un caso para ver su estado y el siguiente paso.</p>
        </div>
        <span className="dashboard-unread-count">{load.data.length} {load.data.length === 1 ? "reporte" : "reportes"}</span>
      </div>
    <div className="own-report-grid">
      {load.data
        .map((report) => {
          const claim = primaryClaim(
            claims.data?.filter(
              (item) =>
                item.lost_report === report.id && item.claimant === user?.id,
            ) ?? [],
          );
          return { report, progress: reportProgress(report, claim) };
        })
        // Primero lo que necesita que la persona haga algo; lo cerrado, al final.
        .sort((a, b) => TONE_ORDER[a.progress.tone] - TONE_ORDER[b.progress.tone])
        .map(({ report, progress }) => {
        return (
          <Link
            key={report.id}
            className={`own-report-card tone-${progress.tone}`}
            to={`/mis-reportes/${report.id}`}
          >
            <div className="own-report-art">
              <ObjectArt category={report.category} />
            </div>
            <div>
              <StatusPill progress={progress} />
              <h3>{report.description || categoryName(report.category)}</h3>
              <p>
                {report.kind === "lost" ? "Lo perdiste" : "Lo encontraste"} ·{" "}
                {report.approximate_area} · {dateLabel(report.occurred_on)}
              </p>
              <div className="own-report-bottom">
                <span>Reporte {report.folio}</span>
                <span>
                  Ver mi caso
                  <ArrowRight size={17} />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
    </section>
  );
}
