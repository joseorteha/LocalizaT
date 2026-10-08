import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api";
import { claimProgress } from "../../domain";
import { categoryName, dateLabel, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import {
  Button,
  ErrorBox,
  Modal,
  EmptyState,
  NextStep,
  SkeletonCards,
  StatusPill,
} from "../../components/ui";
import { ObjectArt } from "../../components/Art";

export function PublicDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const {
    data: report,
    loading,
    error,
    errorStatus,
    reload,
  } = useLoad(() => api.publicReport(id), id);
  const { user, sessionLoading, openAuth, toast } = useApp();
  const [claimOpen, setClaimOpen] = useState(false);
  const { busy, error: formError, setError, run } = useAction();
  const [sent, setSent] = useState(false);
  const [sentClaimId, setSentClaimId] = useState<number | null>(null);
  useEffect(() => {
    setSent(false);
    setSentClaimId(null);
    setError("");
    setClaimOpen(false);
  }, [id, setError]);
  const own = useLoad(
    () => (user ? api.reports() : Promise.resolve([])),
    String(user?.id),
  );
  const claims = useLoad(
    () => (user ? api.claims() : Promise.resolve([])),
    `${user?.id}-${sent}`,
  );
  const isMine = own.data?.some((item) => item.id === id) ?? false;
  const myClaim =
    claims.data?.find(
      (item) => item.found_report === id && item.claimant === user?.id,
    ) ?? null;
  const myLost =
    own.data?.filter(
      (item) => item.kind === "lost" && item.status === "active",
    ) ?? [];
  // Si la persona reportó una pérdida de la misma categoría, la proponemos.
  const suggestedLost =
    myLost.find((item) => item.id === params.get("loss"))?.id ??
    (myLost.filter((item) => item.category === report?.category).length === 1
      ? myLost.find((item) => item.category === report?.category)?.id
      : "") ??
    "";
  const contextLoading =
    sessionLoading || Boolean(user && (own.loading || claims.loading));
  useEffect(() => {
    if (
      params.get("action") === "claim" &&
      user &&
      !contextLoading &&
      report?.kind === "found"
    ) {
      if (!myClaim && !isMine && !own.error && !claims.error)
        setClaimOpen(true);
      const next = new URLSearchParams(params);
      next.delete("action");
      setParams(next, { replace: true });
    }
  }, [
    params,
    setParams,
    user,
    contextLoading,
    report,
    myClaim,
    isMine,
    own.error,
    claims.error,
  ]);
  const claimLink = myClaim
    ? `/mi-espacio?section=claims&claim=${myClaim.id}`
    : "/mi-espacio?section=claims";
  function startClaim() {
    if (user) setClaimOpen(true);
    else {
      const next = new URLSearchParams(params);
      next.set("action", "claim");
      openAuth(`/avisos/${id}?${next}`, "signup");
    }
  }
  function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    run(async () => {
      const createdClaim = await api.createClaim(
        id,
        String(fields.get("evidence")),
        String(fields.get("lost") ?? "") || undefined,
      );
      setSent(true);
      claims.reload();
      setSentClaimId(createdClaim.id);
      toast("Enviamos tu solicitud de devolución al equipo.");
    });
  }
  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share)
        await navigator.share({ title: "Aviso en LocalizaT", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado. Compártelo con quien pueda ayudar.");
      }
    } catch {
      /* Cancelar la hoja de compartir no cambia el aviso. */
    }
  }
  if (loading || (error && contextLoading))
    return (
      <div className="page-container">
        <SkeletonCards count={1} />
      </div>
    );
  if (error || !report)
    return (
      <div className="page-container">
        {errorStatus === 404 && myClaim && !claims.error ? (
          <>
            <h1>Tu solicitud sigue en Mi espacio</h1>
            <p>
              El aviso público dejó de estar disponible. Eso no borra tu
              solicitud: consulta su estado y la respuesta del equipo.
            </p>
            <NextStep progress={claimProgress(myClaim)}>
              <Link className="btn btn-primary" to={claimLink}>
                Ver mi solicitud <ArrowRight size={17} />
              </Link>
            </NextStep>
          </>
        ) : errorStatus === 404 && isMine && !own.error ? (
          <EmptyState
            title="Este es tu reporte"
            text="Este reporte no tiene un aviso público disponible. Puedes consultar tu caso y su estado desde tu cuenta."
          >
            <Link className="btn btn-primary" to={`/mis-reportes/${id}`}>
              Ver mi caso <ArrowRight size={17} />
            </Link>
          </EmptyState>
        ) : errorStatus === 404 ? (
          <EmptyState
            title="Este aviso ya no está disponible"
            text="Puede haberse retirado, reservado o cerrado. Si ya solicitaste una devolución, entra a tu cuenta y revísala en Mi espacio."
          >
            <Link className="btn btn-primary" to="/mi-espacio?section=claims">
              Ver mis solicitudes
            </Link>
          </EmptyState>
        ) : (
          <ErrorBox
            message={error || "No pudimos cargar este aviso."}
            retry={reload}
          />
        )}
        <Link to="/explorar" className="text-link">
          Volver a los avisos <ArrowRight size={16} />
        </Link>
      </div>
    );
  const found = report.kind === "found";
  return (
    <div className="page-container">
      <Link className="back-link" to="/explorar">
        <ArrowLeft size={16} />
        Volver a los avisos
      </Link>
      <div className="detail-layout">
        <div className={`detail-art category-${report.category}`}>
          <span className={`kind-pill kind-${report.kind}`}>
            {found ? "Encontrado" : "Se busca"}
          </span>
          <ObjectArt category={report.category} />
          <span className="card-art-label">
            DIBUJO DE REFERENCIA · NO ES FOTO DEL OBJETO
          </span>
        </div>
        <div className="detail-copy">
          <span className="tiny-label">{categoryName(report.category)}</span>
          <h1>{report.public_summary}</h1>
          <div className="detail-meta">
            <p>
              <MapPin size={18} />
              {found ? "Lo encontraron en " : "Se perdió en "}
              {report.public_area}
            </p>
            <p>
              <CalendarDays size={18} />
              {dateLabel(report.occurred_on)}
            </p>
          </div>
          {contextLoading ? (
            <p className="loading-message">
              Comprobando si este aviso ya está en tus casos…
            </p>
          ) : own.error || claims.error ? (
            <ErrorBox
              message={own.error || claims.error}
              retry={() => {
                own.reload();
                claims.reload();
              }}
            />
          ) : isMine ? (
            <div className="detail-callout">
              <p>Este es tu aviso.</p>
              <Link className="btn btn-primary" to={`/mis-reportes/${id}`}>
                Ver cómo va mi caso
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : myClaim ? (
            <div className="detail-callout">
              <StatusPill progress={claimProgress(myClaim)} />
              <p>Ya solicitaste la devolución de este objeto.</p>
              <Link className="btn btn-primary" to={claimLink}>
                Ver cómo va
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : found ? (
            <>
              <Button onClick={startClaim}>
                Solicitar devolución <ArrowRight size={18} />
              </Button>
              <p className="hint">
                Te pediremos un detalle secreto. Una persona del equipo lo
                comprueba antes de cualquier entrega.
              </p>
            </>
          ) : (
            <>
              <Link to="/reportar?kind=found" className="btn btn-primary">
                Encontré algo así <ArrowRight size={18} />
              </Link>
              <p className="hint">
                Haz un reporte de lo que encontraste y lo compararemos con este
                aviso.
              </p>
            </>
          )}
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>
              Este aviso solo muestra datos generales. El contacto y los
              detalles privados quedan protegidos; el equipo verifica la
              propiedad antes de coordinar una entrega.
            </p>
          </div>
          <button className="text-link share-link" onClick={share}>
            <Share2 size={17} />
            Compartir este aviso
          </button>
        </div>
      </div>
      <Modal
        open={claimOpen}
        onOpenChange={(open) => {
          if (!busy) setClaimOpen(open);
        }}
        title={sent ? "Solicitud enviada" : "Solicitar la devolución"}
        description={
          sent
            ? "Una persona del equipo comparará tu detalle secreto con el objeto."
            : "Cuéntanos un detalle privado que permita revisar tu propiedad. Solo tu cuenta y el equipo autorizado lo verán."
        }
      >
        {sent ? (
          <div className="form-stack">
            <p>
              Tu solicitud quedó registrada. Consulta la respuesta del equipo
              en «Novedades» (la campana) o en Mi espacio. Puedes activar avisos
              en este dispositivo; no enviamos correo ni SMS.
            </p>
            <Link
              className="btn btn-primary"
              to={
                sentClaimId
                  ? `/mi-espacio?section=claims&claim=${sentClaimId}`
                  : claimLink
              }
              onClick={() => setClaimOpen(false)}
            >
              Ver mi solicitud
              <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submitClaim}>
            <label>
              Tu detalle secreto
              <textarea
                name="evidence"
                required
                minLength={15}
                maxLength={1000}
                rows={4}
                placeholder="Ej.: tiene mi nombre escrito por dentro; traía un cuaderno verde"
              />
              <small>
                Algo que no se ve en el aviso. No escribas contraseñas ni datos
                del banco.
              </small>
            </label>
            {myLost.length > 0 && (
              <label>
                ¿Es lo que reportaste como perdido?
                <select name="lost" defaultValue={suggestedLost}>
                  <option value="">Continuar sin vincular un reporte</option>
                  {myLost.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {formError && <ErrorBox message={formError} />}
            <Button type="submit" busy={busy}>
              Enviar solicitud <ArrowRight size={17} />
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
