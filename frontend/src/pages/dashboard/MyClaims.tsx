import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, type Claim } from "../../api";
import { claimProgress } from "../../domain";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import {
  EmptyState,
  ErrorBox,
  SkeletonCards,
  StatusPill,
} from "../../components/ui";
import { ObjectArt } from "../../components/Art";
import { ClaimDialog } from "./ClaimDialog";

export function MyClaims() {
  const load = useLoad(api.claims);
  const { user } = useApp();
  const ownClaims =
    load.data?.filter((claim) => claim.claimant === user?.id) ?? [];
  const [params, setParams] = useSearchParams();
  const selected =
    Number(params.get("claim")) > 0 ? Number(params.get("claim")) : null;
  function selectClaim(id: number | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("claim", String(id));
    else next.delete("claim");
    setParams(next, { replace: true });
  }
  if (load.loading && !load.data) return <SkeletonCards />;
  if (load.error) return <ErrorBox message={load.error} retry={load.reload} />;
  return (
    <>
      {!ownClaims.length ? (
        <EmptyState
          category="accessory"
          title="Todavía no has solicitado una devolución."
          text="Si reconoces algo tuyo entre los objetos encontrados, abre el aviso y toca «Solicitar devolución». El equipo revisará tu propiedad. No necesitas haber reportado una pérdida antes."
        >
          <Link className="btn btn-primary" to="/explorar?kind=found">
            Ver objetos encontrados
            <ArrowRight size={17} />
          </Link>
        </EmptyState>
      ) : (
        <section className="dashboard-section" aria-labelledby="claims-title">
          <div className="dashboard-section-head">
            <div>
              <span className="eyebrow">OBJETOS QUE RECONOCISTE</span>
              <h2 id="claims-title">Tus solicitudes</h2>
              <p>Consulta la revisión de propiedad y confirma la recepción solo cuando tengas el objeto.</p>
            </div>
            <span className="dashboard-unread-count">{ownClaims.length} {ownClaims.length === 1 ? "solicitud" : "solicitudes"}</span>
          </div>
        <div className="case-list">
          {ownClaims.map((claim: Claim) => (
            <button
              className="case-row"
              key={claim.id}
              onClick={() => selectClaim(claim.id)}
            >
              <div className="case-icon">
                <ObjectArt category={claim.found_summary.category} />
              </div>
              <div className="case-main">
                <StatusPill progress={claimProgress(claim)} />
                <h3>
                  {claim.found_summary.public_summary ||
                    categoryName(claim.found_summary.category)}
                </h3>
                <span>
                  Solicitado el {dateLabel(claim.created_at)} ·{" "}
                  {claim.found_summary.public_area}
                </span>
              </div>
              <ArrowRight size={19} />
            </button>
          ))}
        </div>
        </section>
      )}
      <ClaimDialog
        // La dirección (?claim=) ya decide si está abierta.
        closeOnBack={false}
        claimId={selected}
        onClose={() => selectClaim(null)}
        onUpdated={load.reload}
      />
    </>
  );
}
