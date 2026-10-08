import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, Check, ClipboardCheck, Eye, PackageCheck, Sparkles } from "lucide-react";
import { api, type Claim, type Notice, type Report } from "../../api";
import { dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { EmptyState, ErrorBox, SkeletonCards } from "../../components/ui";
import { PushSettings } from "./PushSettings";

const noticeKinds = {
  match: { label: "Posible coincidencia", icon: Sparkles },
  claim: { label: "Solicitud", icon: ClipboardCheck },
  publication: { label: "Aviso público", icon: Eye },
  handover: { label: "Entrega", icon: PackageCheck },
} as const;

function destination(item: Notice, reports: Report[] | null, claims: Claim[] | null, userId?: number) {
  if (!item.report_id) return null;
  if (reports?.some((report) => report.id === item.report_id)) {
    return { to: `/mis-reportes/${item.report_id}`, label: "Ver mi caso" };
  }
  const claim = claims?.find((candidate) => candidate.found_report === item.report_id && candidate.claimant === userId);
  return claim ? { to: `/mi-espacio?section=claims&claim=${claim.id}`, label: "Ver mi solicitud" } : null;
}

export function MyNotices() {
  const load = useLoad(api.notices);
  const own = useLoad(api.reports);
  const claims = useLoad(api.claims);
  const { toast, refreshUnread, user } = useApp();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const notices = load.data ?? [];
  const unread = notices.filter((item) => !item.read_at).length;
  const shown = filter === "unread" ? notices.filter((item) => !item.read_at) : notices;

  async function markRead(id: number) {
    try {
      await api.readNotice(id);
      load.reload();
      refreshUnread();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "No se pudo marcar como leída.", "error");
    }
  }

  return (
    <section className="dashboard-section" aria-labelledby="notices-title">
      <div className="dashboard-section-head">
        <div>
          <span className="eyebrow">ACTIVIDAD DE TUS CASOS</span>
          <h2 id="notices-title">Tus novedades</h2>
          <p>Las coincidencias son sugerencias; el equipo verifica la propiedad antes de coordinar una entrega.</p>
        </div>
        {unread > 0 && <span className="dashboard-unread-count">{unread} sin leer</span>}
      </div>

      <div className="notices-layout">
        <div className="notices-main">
          {notices.length > 0 && (
            <div className="notice-filters" aria-label="Filtrar novedades">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Todas <span>{notices.length}</span></button>
              <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Sin leer <span>{unread}</span></button>
            </div>
          )}
          {load.loading && !load.data ? <SkeletonCards /> : load.error ? (
            <ErrorBox message={load.error} retry={load.reload} />
          ) : !notices.length ? (
            <EmptyState
              category="book"
              title="Aún no hay novedades."
              text="Cuando cambie el estado de un caso o aparezca una posible coincidencia, lo verás aquí."
            />
          ) : !shown.length ? (
            <div className="notice-caught-up"><Check size={22} /><strong>Estás al día</strong><p>Ya leíste todas tus novedades.</p><button type="button" className="text-link" onClick={() => setFilter("all")}>Ver todas</button></div>
          ) : (
            <div className="notice-list">
              {shown.map((item) => {
                const kind = noticeKinds[item.kind as keyof typeof noticeKinds];
                const Icon = kind?.icon ?? Bell;
                const link = destination(item, own.data, claims.data, user?.id);
                return (
                  <article className={`notice-row notice-${item.kind} ${item.read_at ? "" : "unread"}`} key={item.id}>
                    <span className="notice-icon"><Icon size={20} aria-hidden="true" /></span>
                    <div className="notice-content">
                      <div className="notice-meta">
                        <span className="notice-kind">{kind?.label ?? "Actualización"}</span>
                        <time dateTime={item.created_at}>{dateLabel(item.created_at)}</time>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                      <div className="notice-actions">
                        {link && (
                          <Link className="notice-primary-link" to={link.to} onClick={() => { if (!item.read_at) void markRead(item.id); }}>
                            {link.label} <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        )}
                        {!item.read_at && (
                          <button type="button" className="notice-read-button" onClick={() => void markRead(item.id)}>
                            <Check size={15} aria-hidden="true" /> Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <aside className="notices-side" aria-label="Configuración de avisos y ayuda">
          <PushSettings />
          <div className="notice-help-card">
            <strong>¿Qué significa una coincidencia?</strong>
            <p>Que hay dos reportes que podrían referirse al mismo objeto. Revísalos antes de solicitar una devolución; la coincidencia no confirma quién es el dueño.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
