import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Mail, PackageCheck } from "lucide-react";
import { api, type Claim } from "../../api";
import { claimProgress } from "../../domain";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import {
  Button,
  EmptyState,
  ErrorBox,
  Modal,
  StatusPill,
} from "../../components/ui";

const DECISIONS = [
  ["approve", "Sí, es suyo", "El detalle secreto coincide con el objeto."],
  ["reject", "No coincide", "La evidencia no corresponde al objeto."],
  ["dispute", "Necesito revisar más", "Falta información o hay dudas."],
] as const;

const waiting = (claim: Claim) =>
  ["submitted", "disputed"].includes(claim.status) ||
  (claim.status === "approved" && !claim.handover);

export function ClaimsReview() {
  const load = useLoad(api.claims);
  const [selected, setSelected] = useState<number | null>(null);
  const detail = useLoad(
    () => (selected ? api.claim(selected) : Promise.resolve(null)),
    String(selected),
  );
  const [decision, setDecision] = useState("approve");
  const { busy, error, setError, run } = useAction();
  const { toast } = useApp();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail.data) return;
    const claim = detail.data;
    const reason = String(new FormData(event.currentTarget).get("reason"));
    run(async () => {
      if (claim.status === "approved")
        await api.startHandover(claim.id, reason);
      else await api.decideClaim(claim.id, decision, reason);
      toast("Listo. La persona recibirá una novedad.");
      detail.reload();
      load.reload();
    });
  }
  if (load.loading && !load.data)
    return <p className="loading-message">Cargando reclamaciones…</p>;
  if (load.error) return <ErrorBox message={load.error} retry={load.reload} />;
  const pending = load.data?.filter(waiting) ?? [];
  const decided = load.data?.filter((claim) => !waiting(claim)) ?? [];
  const row = (item: Claim) => (
    <article className="ops-row" key={item.id}>
      <div>
        <StatusPill progress={claimProgress(item)} />
        <h3>
          {item.found_summary.public_summary ||
            categoryName(item.found_summary.category)}
        </h3>
        <p>
          Reclamación #{item.id} · {dateLabel(item.created_at)}
        </p>
      </div>
      <Button
        variant={waiting(item) ? "primary" : "secondary"}
        onClick={() => {
          setSelected(item.id);
          setError("");
          setDecision("approve");
        }}
      >
        {waiting(item) ? "Revisar" : "Ver"}
        <ArrowRight size={16} />
      </Button>
    </article>
  );
  const claim = detail.data;
  const check = claim?.verification;
  return (
    <>
      {!load.data?.length ? (
        <EmptyState
          category="accessory"
          title="No hay reclamaciones."
          text="Cuando alguien diga «es mío» sobre un objeto encontrado, aparecerá aquí."
        />
      ) : (
        <>
          <h2 className="ops-list-title">Por revisar ({pending.length})</h2>
          {pending.length ? (
            <div className="case-list">{pending.map(row)}</div>
          ) : (
            <p className="hint">No hay reclamaciones esperando.</p>
          )}
          {decided.length > 0 && (
            <>
              <h2 className="ops-list-title">Ya decididas</h2>
              <div className="case-list">{decided.map(row)}</div>
            </>
          )}
        </>
      )}
      <Modal
        wide
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
        title="¿Es de esta persona?"
        description="Compara el detalle secreto con lo que se sabe del objeto. Tu acceso queda registrado."
      >
        {detail.loading ? (
          <p>Cargando…</p>
        ) : detail.error ? (
          <ErrorBox message={detail.error} retry={detail.reload} />
        ) : (
          claim && (
            <div className="form-stack">
              <StatusPill progress={claimProgress(claim)} />
              <div className="compare-grid">
                <div className="compare-card compare-claim">
                  <span className="tiny-label">DICE QUIEN RECLAMA</span>
                  <p>{claim.evidence}</p>
                </div>
                <div className="compare-card">
                  <span className="tiny-label">
                    SU DETALLE SECRETO AL REPORTAR LA PÉRDIDA
                  </span>
                  <p>
                    {check?.lost?.ownership_clue ||
                      "No vinculó un reporte de pérdida."}
                  </p>
                  {check?.lost && (
                    <small>
                      Perdido: {check.lost.description} ·{" "}
                      {check.lost.approximate_area} ·{" "}
                      {dateLabel(check.lost.occurred_on)}
                    </small>
                  )}
                </div>
                <div className="compare-card">
                  <span className="tiny-label">
                    LO QUE DESCRIBIÓ QUIEN LO ENCONTRÓ
                  </span>
                  <p>{check?.found.description}</p>
                  {check && (
                    <small>
                      {check.found.approximate_area} ·{" "}
                      {dateLabel(check.found.occurred_on)} · Reporte{" "}
                      {check.found.folio}
                    </small>
                  )}
                </div>
              </div>
              {check && (
                <div className="contact-box">
                  <span className="tiny-label">
                    PARA COORDINAR LA ENTREGA (NO COMPARTIR)
                  </span>
                  <p>
                    <Mail size={15} /> Quien reclama: {check.claimant_email}
                  </p>
                  <p>
                    <Mail size={15} /> Quien lo encontró:{" "}
                    {check.found.owner_email}
                  </p>
                </div>
              )}
              {claim.decision_reason && (
                <p className="hint">Última decisión: {claim.decision_reason}</p>
              )}
              {waiting(claim) ? (
                <form className="form-stack" onSubmit={submit}>
                  {claim.status !== "approved" ? (
                    <fieldset className="decision-choices">
                      <legend>Tu decisión</legend>
                      {DECISIONS.map(([value, label, hint]) => (
                        <label key={value} className="decision-option">
                          <input
                            type="radio"
                            name="decision"
                            value={value}
                            checked={decision === value}
                            onChange={() => setDecision(value)}
                          />
                          <span>
                            <strong>{label}</strong>
                            <small>{hint}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <div className="privacy-note">
                      <PackageCheck size={23} />
                      <p>
                        Ya se comprobó que es suyo. Escribe a ambas personas
                        para acordar dónde y cuándo, y cuando entregues el
                        objeto, registra aquí la entrega. La persona confirmará
                        desde su cuenta.
                      </p>
                    </div>
                  )}
                  <label>
                    {claim.status === "approved"
                      ? "¿Cómo y dónde se entregó?"
                      : "Explica tu decisión (la persona la leerá)"}
                    <textarea
                      name="reason"
                      rows={3}
                      required
                      minLength={8}
                      maxLength={500}
                      placeholder={
                        claim.status === "approved"
                          ? "Ej.: entregado en el punto del centro el martes"
                          : "Ej.: el detalle del nombre por dentro coincide"
                      }
                    />
                  </label>
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" busy={busy}>
                    <Check size={18} />
                    {claim.status === "approved"
                      ? "Registrar la entrega"
                      : "Guardar decisión"}
                  </Button>
                </form>
              ) : (
                <p className="success-note">
                  {claim.handover?.status === "pending"
                    ? "Entrega registrada. Falta que la persona confirme que lo recibió."
                    : "Este caso ya tiene una decisión."}
                </p>
              )}
            </div>
          )
        )}
      </Modal>
    </>
  );
}
