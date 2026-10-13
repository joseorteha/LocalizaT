import { Download, RefreshCw } from "lucide-react";
import type { Metrics } from "../../api";
import { categoryName } from "../../lib";
import { ErrorBox } from "../../components/ui";

const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : "—");

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <ul className="metric-bars">
      {rows.map(([label, value]) => (
        <li key={label}>
          <span className="metric-bar-label">{label}</span>
          <span className="metric-bar-track" aria-hidden="true">
            <span style={{ width: `${(value / max) * 100}%` }} />
          </span>
          <strong>{value}</strong>
        </li>
      ))}
    </ul>
  );
}

// Cifras agregadas del servicio: sirven para decidir y para informar (NAUFest)
// con datos reales. Nunca muestran datos de una persona.
export function Summary({ metrics, error, reload }: { metrics: Metrics | null; error: string; reload: () => void }) {
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!metrics) return <p className="loading-message">Calculando cifras…</p>;
  const weeks = metrics.reports_by_week.map((week): [string, number] => [
    new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(week.week + "T12:00:00")),
    week.lost + week.found,
  ]);
  const categories = Object.entries(metrics.reports_by_category)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]): [string, number] => [categoryName(key), value]);
  const places = Object.entries(metrics.reports_by_municipality).slice(0, 8);
  function download() {
    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `localizat-cifras-${metrics!.generated_at.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <>
      <div className="case-section-heading">
        <h2>Cómo va el servicio</h2>
        <div className="summary-actions">
          <button className="text-link" type="button" onClick={reload}>
            <RefreshCw size={17} /> Actualizar
          </button>
          <button className="text-link" type="button" onClick={download}>
            <Download size={17} /> Descargar cifras
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric-tile">
          <strong>{metrics.reports_total}</strong>
          <span>Reportes</span>
          <small>{metrics.reports_lost} pérdidas · {metrics.reports_found} hallazgos</small>
        </div>
        <div className="metric-tile">
          <strong>{metrics.returned_total}</strong>
          <span>Objetos devueltos</span>
          <small>
            {metrics.median_days_to_return !== null
              ? `La mitad volvió en ${metrics.median_days_to_return} días o menos`
              : "Aún sin devoluciones confirmadas"}
          </small>
        </div>
        <div className="metric-tile">
          <strong>{percent(metrics.lost_with_suggestion, metrics.lost_total)}</strong>
          <span>Pérdidas con una coincidencia</span>
          <small>{metrics.lost_with_suggestion} de {metrics.lost_total} · {metrics.suggestions_total} sugerencias en total</small>
        </div>
        <div className="metric-tile">
          <strong>{metrics.users_total}</strong>
          <span>Cuentas</span>
          <small>{metrics.users_verified} con correo verificado · {metrics.users_new_30d} nuevas en 30 días</small>
        </div>
        <div className="metric-tile">
          <strong>{metrics.reports_new_7d}</strong>
          <span>Reportes esta semana</span>
          <small>{metrics.reports_new_30d} en los últimos 30 días</small>
        </div>
        <div className={`metric-tile ${metrics.emails_failed || metrics.matching_jobs_failed ? "metric-alert" : ""}`}>
          <strong>{metrics.emails_failed + metrics.matching_jobs_failed}</strong>
          <span>Fallos por revisar</span>
          <small>{metrics.emails_failed} correos · {metrics.matching_jobs_failed} comparaciones · {metrics.emails_pending} correos en cola</small>
        </div>
      </div>
      <div className="metric-columns">
        <section>
          <h3>Reportes por semana</h3>
          {weeks.length ? <Bars rows={weeks} /> : <p className="hint">Sin reportes en las últimas 8 semanas.</p>}
        </section>
        <section>
          <h3>Qué se pierde más</h3>
          {categories.length ? <Bars rows={categories} /> : <p className="hint">Sin datos todavía.</p>}
        </section>
        <section>
          <h3>Dónde</h3>
          {places.length ? <Bars rows={places} /> : <p className="hint">Sin datos todavía.</p>}
        </section>
      </div>
      <p className="hint">
        Cifras del {new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(metrics.generated_at))}.
        Son conteos del sistema, no una muestra de toda la Sierra: úsalas con su fecha y su contexto.
      </p>
    </>
  );
}
