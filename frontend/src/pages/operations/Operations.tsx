import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { useLoad } from "../../lib";
import { useApp } from "../../context";
import { PageIntro } from "../../components/ui";
import { Publications } from "./Publications";
import { Matches } from "./Matches";
import { ClaimsReview } from "./ClaimsReview";
import { Custody } from "./Custody";

type Section = "publications" | "matches" | "claims" | "custody";

export function Operations() {
  const { user } = useApp();
  const [chosen, setChosen] = useState<Section | null>(null);
  const metrics = useLoad(
    () => (user?.is_staff ? api.metrics() : Promise.resolve(null)),
    String(user?.id),
  );
  const counts: Record<Section, number | null> = {
    publications: metrics.data?.publications_pending ?? null,
    claims: metrics.data
      ? (metrics.data.claims_by_status.submitted ?? 0) +
        (metrics.data.claims_by_status.disputed ?? 0)
      : null,
    matches: metrics.data?.suggestions_pending ?? null,
    custody: null,
  };
  const tabs: [Section, string, string][] = user?.is_staff
    ? [
        ["publications", "Avisos por revisar", "Aprobar o pedir cambios"],
        ["claims", "Reclamaciones", "Comprobar quién es dueño"],
        ["matches", "Coincidencias", "Pares que sugirió el sistema"],
        ["custody", "Custodia", "Objetos en los puntos"],
      ]
    : [["custody", "Custodia", "Objetos en tu punto"]];
  // Sin elección, abre la primera sección con trabajo pendiente.
  const section: Section =
    chosen ??
    (user?.is_staff
      ? (tabs.find(([value]) => (counts[value] ?? 0) > 0)?.[0] ??
        "publications")
      : "custody");
  return (
    <div className="page-container">
      <PageIntro
        label="PANEL DEL EQUIPO"
        title="Lo que falta revisar"
        description="Cada decisión queda registrada. Revisa con calma y nunca publiques datos personales."
      >
        <span className="operator-badge">
          <ShieldCheck size={19} />
          Acceso del equipo
        </span>
      </PageIntro>
      <div className="ops-tiles">
        {tabs.map(([value, label, hint]) => (
          <button
            key={value}
            className="ops-tile"
            aria-pressed={section === value}
            onClick={() => {
              setChosen(value);
              metrics.reload();
            }}
          >
            {counts[value] !== null && (
              <strong className={counts[value] ? "has-work" : ""}>
                {counts[value]}
              </strong>
            )}
            <span>{label}</span>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      {user?.is_staff && metrics.data && (
        <p className="ops-summary">
          Objetos devueltos con éxito: {metrics.data.handovers_confirmed}
        </p>
      )}
      {user?.is_staff && !chosen && metrics.loading ? (
        // Espera los conteos para abrir directo en la sección con trabajo.
        <p className="loading-message">Revisando qué falta…</p>
      ) : section === "publications" ? (
        <Publications />
      ) : section === "matches" ? (
        <Matches />
      ) : section === "claims" ? (
        <ClaimsReview />
      ) : (
        <Custody />
      )}
    </div>
  );
}
