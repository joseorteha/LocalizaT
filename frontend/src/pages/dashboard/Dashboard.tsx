import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Bell, ClipboardList, FileText, Plus, ShieldCheck } from "lucide-react";
import { useApp } from "../../context";
import { PageIntro } from "../../components/ui";
import { MyReports } from "./MyReports";
import { MyClaims } from "./MyClaims";
import { MyNotices } from "./MyNotices";

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const { user, unread } = useApp();
  const section = params.get("section") ?? "reports";
  const tabs = [
    { value: "reports", label: "Mis reportes", icon: FileText },
    { value: "claims", label: "Solicitudes", ariaLabel: "Solicitudes de devolución", icon: ClipboardList },
    { value: "alerts", label: "Novedades", icon: Bell },
  ];
  return (
    <div className="page-container dashboard-page">
      <PageIntro
        label="SEGUIMIENTO"
        title="Mi espacio"
        description="Sigue lo que perdiste o encontraste, revisa tus solicitudes y descubre qué ha cambiado en cada caso."
      >
        <Link className="btn btn-primary" to="/reportar">
          <Plus size={17} />
          Nuevo reporte
        </Link>
      </PageIntro>
      {user && (user.is_staff || user.is_point_member) && (
        <Link className="operator-link" to="/operacion">
          <ShieldCheck size={18} />
          Tienes acceso al panel del equipo
          <ArrowRight size={18} />
        </Link>
      )}
      <nav className="page-tabs dashboard-tabs" aria-label="Secciones de mi espacio">
        {tabs.map(({ value, label, ariaLabel, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={section === value}
            onClick={() => setParams({ section: value })}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
            {value === "alerts" && unread > 0 && <span className="dashboard-tab-count">{unread}</span>}
          </button>
        ))}
      </nav>
      {section === "claims" ? (
        <MyClaims />
      ) : section === "alerts" ? (
        <MyNotices />
      ) : (
        <MyReports />
      )}
    </div>
  );
}
