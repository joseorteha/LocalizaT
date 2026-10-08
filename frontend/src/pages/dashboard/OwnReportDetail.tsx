import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  EyeOff,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, type Report } from "../../api";
import { primaryClaim, reportProgress, type CaseProgress } from "../../domain";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import {
  Button,
  ErrorBox,
  Modal,
  NextStep,
  PublicCard,
  SkeletonCards,
  StatusPill,
  Tag,
} from "../../components/ui";
import { PublishDialog } from "../../components/PublishDialog";
import { ClaimDialog } from "./ClaimDialog";

export function OwnReportDetail() {
  const { id = "" } = useParams();
  const load = useLoad(() => api.report(id), id);
  const suggestions = useLoad(() => api.suggestions(id), id);
  const claims = useLoad(api.claims);
  const [publish, setPublish] = useState(false);
  const [close, setClose] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const { busy, run } = useAction();
  const { toast, user } = useApp();
  function action(operation: "close" | "withdraw") {
    run(
      async () => {
        await api[operation](id);
        toast(
          operation === "close"
            ? "Cerraste tu reporte."
            : "Quitamos tu aviso de la lista pública.",
        );
        load.reload();
        setClose(false);
      },
      { onError: (message) => toast(message, "error") },
    );
  }
  function publishBasic() {
    run(
      async () => {
        await api.publishBasic(id);
        toast("Tu aviso básico ya es visible para la comunidad.");
        load.reload();
      },
      { onError: (message) => toast(message, "error") },
    );
  }
  // Sin las reclamaciones, el "¿qué sigue?" de una pérdida podría ser falso.
  if ((load.loading && !load.data) || (claims.loading && !claims.data))
    return (
      <div className="page-container">
        <SkeletonCards count={1} />
      </div>
    );
  if (load.error || claims.error || !load.data)
    return (
      <div className="page-container">
        <ErrorBox
          message={load.error || claims.error || "No encontramos tu reporte."}
          retry={() => {
            load.reload();
            claims.reload();
          }}
        />
      </div>
    );
  const report = load.data;
  const lost = report.kind === "lost";
  const active = report.status === "active";
  const claim = primaryClaim(
    claims.data?.filter(
      (item) => item.lost_report === report.id && item.claimant === user?.id,
    ) ?? [],
  );
  const progress = reportProgress(report, claim);
  const matches = suggestions.data ?? [];
  // Cuando el equipo ya comprobó que es tuyo, buscar parecidos solo confunde.
  const searching = active && claim?.status !== "approved";
  return (
    <div className="page-container case-page">
      <Link className="back-link" to="/mi-espacio">
        <ArrowLeft size={16} />
        Mis reportes
      </Link>
      <header className="case-header">
        <StatusPill progress={progress} />
        <h1>{report.description || categoryName(report.category)}</h1>
        <p>
          {lost
            ? "Reportaste que lo perdiste"
            : "Reportaste que lo encontraste"}{" "}
          · {report.approximate_area} · {dateLabel(report.occurred_on)}
        </p>
      </header>

      <NextStep progress={progress}>
        <NextActions
          report={report}
          action={progress.action}
          claimWaiting={claim?.handover?.status === "pending"}
          onPublish={() => setPublish(true)}
          onConfirm={() => setClaimOpen(true)}
        />
      </NextStep>

      {active && (
        <aside className="visibility-note">
          <Globe2 size={21} />
          <div>
            <strong>Aviso para la comunidad</strong>
            <Tag value={report.publication_status} domain="publication" />
            <p>
              {report.publication_status === "public"
                ? "El aviso general ya se ve en la lista pública. La descripción completa y tus datos de cuenta siguen privados."
                : report.publication_status === "pending"
                  ? "El aviso detallado espera revisión. Si prefieres que aparezca ya, publica la versión básica con solo el tipo de objeto y la región."
                  : report.publication_status === "rejected"
                    ? "El aviso no se publicó. Lee el motivo y corrige el resumen para enviarlo otra vez."
                    : "Tu reporte se compara con los demás, pero no hay un aviso público de este objeto."}
            </p>
            {report.publication_status === "pending" && (
              <button className="text-link" disabled={busy} onClick={publishBasic}>
                Publicar versión básica ahora <ArrowRight size={16} />
              </button>
            )}
            {report.publication_status === "pending" && (
              <button className="text-link" onClick={() => setPublish(true)}>
                Cambiar el aviso para revisión <ArrowRight size={16} />
              </button>
            )}
            {report.publication_status === "private" &&
              progress.action !== "publish" && (
                <button className="text-link" onClick={() => setPublish(true)}>
                  También quiero compartir un aviso <ArrowRight size={16} />
                </button>
              )}
          </div>
        </aside>
      )}

      {report.publication_status === "rejected" &&
        report.publication_review_reason && (
          <div className="review-message">
            <strong>Lo que pidió el equipo</strong>
            <p>{report.publication_review_reason}</p>
          </div>
        )}

      {searching && (
        <section className="case-section" id="parecidos">
          <div className="case-section-heading">
            <h2>
              {lost
                ? "Objetos encontrados parecidos al tuyo"
                : "Personas que buscan algo parecido"}
            </h2>
            <button
              className="icon-button"
              onClick={suggestions.reload}
              aria-label="Buscar de nuevo"
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {suggestions.loading ? (
            <SkeletonCards count={1} />
          ) : suggestions.error ? (
            <ErrorBox message={suggestions.error} retry={suggestions.reload} />
          ) : matches.length ? (
            <>
              <p className="case-section-help">
                {lost
                  ? "Una coincidencia es una posibilidad. Abre el aviso y, si lo reconoces, solicita la devolución con un detalle privado."
                  : "No tienes que hacer nada. Si alguien lo reclama, el equipo comprobará que sea suyo antes de cualquier entrega."}
              </p>
              <div className="suggestion-grid">
                {matches.map((item) => (
                  <div className="suggestion-item" key={item.id}>
                    {item.counterpart ? (
                      <PublicCard report={item.counterpart} />
                    ) : (
                      <div className="private-match">
                        <ShieldCheck size={25} />
                        <h3>Hay un reporte parecido en revisión.</h3>
                        <p>
                          Sus detalles todavía no son públicos. El equipo debe
                          revisarlo; no confirma que sea tu objeto.
                        </p>
                      </div>
                    )}
                    <p className="match-why">
                      Se parece por: {item.reasons.join(", ")}.
                    </p>
                    {lost && item.counterpart && (
                      <Link
                        className="btn btn-primary"
                        to={`/avisos/${item.counterpart.id}?loss=${report.id}`}
                      >
                        Revisar este hallazgo
                        <ArrowRight size={17} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="quiet-state">
              <h3>Todavía no aparece nada parecido.</h3>
              <p>
                {report.publication_status === "public"
                  ? "Comparamos cada reporte nuevo con el tuyo y te avisaremos aquí."
                  : "Tu reporte se compara con los demás aunque no publiques. Un aviso público permite que más personas ayuden."}
              </p>
              <Link className="text-link" to="/explorar">
                Buscar yo en los avisos
                <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="case-section">
        <div className="case-section-heading">
          <h2>Lo que reportaste</h2>
          <LockKeyhole size={20} />
        </div>
        <dl className="metadata-grid">
          <div>
            <dt>Cómo es</dt>
            <dd>{report.description}</dd>
          </div>
          <div>
            <dt>Dónde</dt>
            <dd>{report.approximate_area}</dd>
          </div>
          <div>
            <dt>Cuándo</dt>
            <dd>{dateLabel(report.occurred_on)}</dd>
          </div>
          <div>
            <dt>Número de reporte</dt>
            <dd>{report.folio}</dd>
          </div>
        </dl>
        <p className="hint with-icon">
          <EyeOff size={16} />
          Solo tú y el equipo ven esta información.
          {lost && " Tu detalle secreto nunca se publica."}
        </p>
        {active && report.publication_status === "public" && (
          <div className="public-version">
            <p className="tiny-label">LO QUE VE LA COMUNIDAD</p>
            <p className="public-version-text">
              <Globe2 size={18} />
              {report.public_summary} · {report.public_area}
            </p>
            <div className="public-version-actions">
              <Link className="text-link" to={`/avisos/${id}`}>
                Ver mi aviso
                <ArrowRight size={16} />
              </Link>
              <button
                className="text-link muted-link"
                disabled={busy}
                onClick={() => action("withdraw")}
              >
                Quitarlo de los avisos
              </button>
              <button className="text-link" onClick={() => setPublish(true)}>
                Cambiar municipio del aviso
              </button>
            </div>
          </div>
        )}
      </section>

      {active && (
        <button className="close-report-link" onClick={() => setClose(true)}>
          Ya no necesito este reporte
        </button>
      )}

      <PublishDialog
        report={report}
        open={publish}
        onClose={() => setPublish(false)}
        onDone={load.reload}
      />
      <ClaimDialog
        claimId={claimOpen && claim ? claim.id : null}
        onClose={() => setClaimOpen(false)}
        onUpdated={() => {
          load.reload();
          claims.reload();
        }}
      />
      <Modal
        open={close}
        onOpenChange={setClose}
        title="¿Cerrar este reporte?"
        description="Tu aviso dejará de verse y ya no recibirás coincidencias."
      >
        <div className="form-stack">
          <p>
            Úsalo si ya{" "}
            {lost ? "recuperaste tu objeto" : "devolviste el objeto"} por otro
            medio o ya no necesitas el reporte.
          </p>
          <Button variant="danger" busy={busy} onClick={() => action("close")}>
            Sí, cerrar mi reporte
          </Button>
          <Button variant="ghost" onClick={() => setClose(false)}>
            No, mantenerlo
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// El botón que corresponde al momento del caso; como mucho uno o dos.
function NextActions({
  report,
  action,
  claimWaiting,
  onPublish,
  onConfirm,
}: {
  report: Report;
  action: CaseProgress["action"];
  claimWaiting: boolean;
  onPublish: () => void;
  onConfirm: () => void;
}) {
  if (report.status !== "active") return null;
  if (action === "claim")
    return (
      <Button onClick={onConfirm}>
        {claimWaiting ? "Confirmar que lo recibí" : "Ver respuesta del equipo"}
        <ArrowRight size={17} />
      </Button>
    );
  if (action === "publish")
    return (
      <Button onClick={onPublish}>
        <Globe2 size={17} />
        {report.publication_status === "rejected"
          ? "Corregir mi aviso"
          : "Publicar un aviso"}
      </Button>
    );
  if (action === "matches")
    return (
      <a className="btn btn-primary" href="#parecidos">
        Revisar hallazgos parecidos
        <ArrowDown size={17} />
      </a>
    );
  if (action === "explore")
    return (
      <Link className="btn btn-primary" to="/explorar?kind=found">
        Buscar objetos encontrados <ArrowRight size={17} />
      </Link>
    );
  return null;
}
