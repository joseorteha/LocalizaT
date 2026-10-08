import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  EyeOff,
  Globe2,
  HandHeart,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, type Kind, type Report } from "../api";
import { descriptionExample, suggestedSummary } from "../domain";
import { municipalities, publicRegion } from "../geography";
import { categories, categoryName, dateLabel, daysAgo, today } from "../lib";
import { useAction } from "../hooks/useAction";
import { Button, ErrorBox, PageIntro } from "../components/ui";
import { ObjectArt } from "../components/Art";
import { PublishDialog } from "../components/PublishDialog";
import { useApp } from "../context";

const STEPS = [
  { label: "Qué pasó", hint: "Lo perdiste o lo encontraste" },
  { label: "Cómo es", hint: "Dónde, cuándo y cómo es" },
  { label: "Revisar y guardar", hint: "Un vistazo antes de enviar" },
];

export function ReportWizard() {
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>(
    params.get("kind") === "found" ? "found" : "lost",
  );
  const [category, setCategory] = useState("bag");
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [date, setDate] = useState("");
  const [clue, setClue] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [detailedNotice, setDetailedNotice] = useState(false);
  const [municipality, setMunicipality] = useState("");
  const [summary, setSummary] = useState("");
  const [publicArea, setPublicArea] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const { busy, error, setError, run } = useAction();
  const [created, setCreated] = useState<Report | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const { user, sessionLoading, openAuth } = useApp();
  const stepRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step > 0) {
      stepRef.current?.focus();
      stepRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [step]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      setError("");
      if (step === 1) {
        // Propuesta inicial del aviso; la persona puede cambiarla.
        if (!summary) setSummary(suggestedSummary(kind, category));
        if (!publicArea) setPublicArea(area.slice(0, 80));
      }
      setStep((value) => value + 1);
      return;
    }
    if (!user) {
      openAuth(`/reportar?kind=${kind}`, "signup");
      return;
    }
    run(async () => {
      const report = await api.createReport({
        client_request_id: requestId,
        kind,
        category,
        description,
        approximate_area: area,
        occurred_on: date,
        ownership_clue: kind === "lost" ? clue : "",
      });
      if (!publishNow) {
        setCreated(report);
        return;
      }
      try {
        const result = detailedNotice
          ? await api.publish(report.id, summary, publicArea)
          : await api.publishBasic(report.id, municipality);
        setCreated({ ...report, ...result });
      } catch (caught) {
        // El reporte ya está guardado; solo falta corregir el aviso.
        setCreated(report);
        setPublishError(
          caught instanceof Error
            ? caught.message
            : "No pudimos enviar tu aviso.",
        );
      }
    });
  }
  if (created)
    return (
      <div className="page-container success-page">
        <div className="success-orbit">
          <CheckCheck size={45} />
        </div>
        <h1>¡Listo! Guardamos tu reporte.</h1>
        <div className="next-step next-wait success-next">
          <p className="next-step-label">¿Qué sigue?</p>
          {created.publication_status === "public" ? (
            <p className="next-step-text">
              Tu aviso básico ya se ve en los avisos de la comunidad. La
              descripción completa, tu correo y el detalle de propiedad siguen
              privados. Si aparece algo parecido, lo verás en tu caso y en
              Novedades. La devolución requiere verificación humana.
            </p>
          ) : created.publication_status === "pending" ? (
            <p className="next-step-text">
              Tu reporte está guardado y el aviso está pendiente de revisión.
              Aparecerá en los avisos públicos si el equipo lo aprueba. Consulta
              la respuesta en «Novedades» (la campana).
              {created.kind === "lost"
                ? " Si aparece algo parecido, también te avisaremos."
                : " Mientras tanto, guarda el objeto."}
            </p>
          ) : (
            <p className="next-step-text">
              Tu reporte queda privado para ti y el equipo. Se compara con otros
              reportes aunque no publiques. Puedes compartir un aviso general
              cuando quieras.
            </p>
          )}
          {publishError && <ErrorBox message={publishError} />}
        </div>
        <div className="success-actions">
          {created.publication_status !== "pending" && created.publication_status !== "public" && (
            <Button variant="secondary" onClick={() => setPublishing(true)}>
              <Globe2 size={17} />
              {publishError ? "Corregir mi aviso" : "Publicar un aviso"}
            </Button>
          )}
          <Link className="btn btn-primary" to={`/mis-reportes/${created.id}`}>
            Ver cómo va mi caso
            <ArrowRight size={17} />
          </Link>
        </div>
        <p className="success-footnote">
          Tu número de reporte es <strong>{created.folio}</strong>. Úsalo si
          hablas con el equipo.
        </p>
        <PublishDialog
          report={created}
          open={publishing}
          onClose={() => setPublishing(false)}
          onDone={(result) => {
            setPublishError("");
            setCreated({ ...created, ...result });
          }}
        />
      </div>
    );
  return (
    <div className="page-container">
      <PageIntro
        label="NUEVO REPORTE"
        title={kind === "lost" ? "Perdí algo" : "Encontré algo"}
        description="Describe el objeto, revisa qué será público y guarda tu reporte. Solo necesitas una cuenta al guardarlo."
      />
      <div className="wizard-layout">
        <aside className="wizard-sidebar">
          <span className="tiny-label">TU REPORTE, PASO A PASO</span>
          <ol>
            {STEPS.map((item, index) => (
              <li
                className={
                  step === index ? "current" : step > index ? "complete" : ""
                }
                key={item.label}
              >
                <span>
                  {step > index ? <Check size={16} /> : `0${index + 1}`}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="sidebar-trust">
            <EyeOff size={24} />
            <h3>Tú eliges qué compartir.</h3>
            <p>
              La descripción completa y tu detalle de propiedad son privados
              para ti y el equipo. El aviso básico puede publicarse al momento;
              los detalles que escribas para la comunidad se revisan primero.
            </p>
          </div>
        </aside>
        <div className="wizard-content" ref={stepRef} tabIndex={-1}>
          <div className="wizard-progress-mobile">
            <span>
              Paso {step + 1} de 3 · {STEPS[step].label}
            </span>
            <span className="wizard-bar" aria-hidden="true">
              <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
            </span>
          </div>
          <form className="form-stack" onSubmit={submit}>
            {step === 0 && (
              <>
                <h2>¿Qué te pasó?</h2>
                <div className="kind-choices">
                  <button
                    type="button"
                    aria-pressed={kind === "lost"}
                    onClick={() => setKind("lost")}
                  >
                    <Search size={25} />
                    <strong>Perdí algo</strong>
                    <span>Lo estoy buscando.</span>
                    <span className="choice-check">
                      {kind === "lost" && <Check size={13} />}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={kind === "found"}
                    onClick={() => setKind("found")}
                  >
                    <HandHeart size={26} />
                    <strong>Encontré algo</strong>
                    <span>Quiero devolverlo.</span>
                    <span className="choice-check">
                      {kind === "found" && <Check size={13} />}
                    </span>
                  </button>
                </div>
                <p className="category-heading" id="category-label">
                  ¿Qué tipo de objeto es?
                </p>
                <div
                  className="category-choices"
                  role="group"
                  aria-labelledby="category-label"
                >
                  {categories.map((item) => (
                    <button
                      type="button"
                      aria-pressed={category === item.value}
                      key={item.value}
                      onClick={() => setCategory(item.value)}
                    >
                      <ObjectArt category={item.value} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <p className="hint">
                  No reportes credenciales, documentos ni celulares: por ahora
                  solo objetos como mochilas, ropa, libros o accesorios.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <h2>
                  {kind === "lost"
                    ? "Cuéntanos cómo es lo que perdiste"
                    : "Cuéntanos cómo es lo que encontraste"}
                </h2>
                <label>
                  ¿Cómo es?
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    minLength={12}
                    maxLength={300}
                    rows={3}
                    placeholder={descriptionExample(category)}
                  />
                  <small>Color, tamaño, material. Esto no se publica.</small>
                </label>
                <div className="form-columns">
                  <label>
                    ¿Dónde?
                    <input
                      value={area}
                      onChange={(event) => setArea(event.target.value)}
                      minLength={3}
                      maxLength={120}
                      required
                      placeholder="Ej.: mercado de Tequila"
                    />
                    <small>El lugar o camino, sin dirección exacta.</small>
                  </label>
                  <label>
                    ¿Qué día, más o menos?
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      max={today()}
                      required
                    />
                    <span className="quick-dates">
                      <button type="button" onClick={() => setDate(today())}>
                        Hoy
                      </button>
                      <button type="button" onClick={() => setDate(daysAgo(1))}>
                        Ayer
                      </button>
                    </span>
                  </label>
                </div>
                {kind === "lost" ? (
                  <label>
                    Tu detalle secreto
                    <textarea
                      value={clue}
                      onChange={(event) => setClue(event.target.value)}
                      required
                      minLength={6}
                      maxLength={500}
                      rows={3}
                      placeholder="Ej.: tiene mi nombre escrito por dentro; traía un cuaderno verde"
                    />
                    <small>
                      Algo que solo la persona dueña sabe. El equipo autorizado
                      puede consultarlo para revisar tu propiedad; no se
                      publica.
                    </small>
                  </label>
                ) : (
                  <div className="privacy-note">
                    <HandHeart size={23} />
                    <p>
                      Guarda el objeto por ahora. Cuando el equipo confirme
                      quién es la persona dueña, te dirá cómo entregarlo.
                    </p>
                  </div>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <h2>Revisa que todo esté bien</h2>
                <div className="review-summary">
                  <ObjectArt category={category} />
                  <div>
                    <span className="tiny-label">
                      {kind === "lost" ? "LO PERDISTE" : "LO ENCONTRASTE"}
                    </span>
                    <h3>{description}</h3>
                    <p>
                      {categoryName(category)} · {area} ·{" "}
                      {date ? dateLabel(date) : ""}
                    </p>
                  </div>
                </div>
                {kind === "lost" && (
                  <p className="hint with-icon">
                    <ShieldCheck size={16} />
                    Tu detalle secreto se guarda aparte y nunca se publica.
                  </p>
                )}
                <div className="publish-choice">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={publishNow}
                      onChange={(event) => setPublishNow(event.target.checked)}
                    />
                    Que la comunidad vea un aviso (recomendado)
                  </label>
                  {publishNow && (
                    <>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={detailedNotice}
                          onChange={(event) => setDetailedNotice(event.target.checked)}
                        />
                        Quiero añadir detalles al aviso
                      </label>
                      {detailedNotice ? (
                        <p className="hint">El equipo revisará el texto y la zona antes de publicarlos.</p>
                      ) : (
                        <>
                          <label>
                            Municipio general del aviso (opcional)
                            <select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
                              <option value="">Toda la Sierra / no especificar</option>
                              {municipalities.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <small>El punto del mapa representa la cabecera municipal, no el lugar exacto del objeto.</small>
                          </label>
                          <p className="hint">
                            Se publicará al momento: «{suggestedSummary(kind, category)}» · {municipality || publicRegion}.
                            Los detalles que escribiste en el reporte quedan privados.
                          </p>
                        </>
                      )}
                      {detailedNotice && (
                        <>
                      <label>
                        ¿Qué dirá el aviso?
                        <input
                          value={summary}
                          onChange={(event) => setSummary(event.target.value)}
                          minLength={12}
                          maxLength={160}
                          required
                        />
                        <small>
                          Algo general, como el color. Sin teléfono ni el
                          detalle secreto.
                        </small>
                      </label>
                      <label>
                        ¿En qué zona?
                        <input
                          value={publicArea}
                          onChange={(event) =>
                            setPublicArea(event.target.value)
                          }
                          minLength={3}
                          maxLength={80}
                          required
                        />
                      </label>
                      <p className="hint">
                        Una persona del equipo revisa cada aviso antes de
                        mostrarlo.
                      </p>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="privacy-map">
                  <div>
                    <EyeOff size={18} />
                    <strong>Privado</strong>
                    <p>
                      Descripción completa, detalle de propiedad y correo. Los
                      ve tu cuenta y el equipo autorizado.
                    </p>
                  </div>
                  <div>
                    <Globe2 size={18} />
                    <strong>
                      {publishNow
                        ? detailedNotice ? "Aviso para revisión" : "Aviso inmediato"
                        : "Sin aviso público"}
                    </strong>
                    <p>
                      {publishNow
                        ? detailedNotice
                          ? "Solo el resumen, la zona general, el tipo de objeto y la fecha, si el equipo lo aprueba."
                          : `Se mostrarán el tipo de objeto, la fecha y «${municipality || publicRegion}». El resto queda privado.`
                        : "Puedes pedir su publicación después. La comparación de reportes sigue disponible."}
                    </p>
                  </div>
                </div>
                {!user && (
                  <p className="account-save-hint">
                    Antes de guardar, crea una cuenta o entra a la tuya. Al
                    cerrar esa ventana, tu formulario seguirá aquí. Después toca
                    «Guardar mi reporte».
                  </p>
                )}
              </>
            )}
            {error && <ErrorBox message={error} />}
            <div className="wizard-buttons">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setStep((value) => value - 1)}
                >
                  <ArrowLeft size={17} />
                  Atrás
                </Button>
              )}
              <Button
                type="submit"
                busy={busy}
                disabled={step === 2 && sessionLoading}
              >
                {step === 2
                  ? user
                    ? "Guardar mi reporte"
                    : "Continuar con mi cuenta"
                  : "Siguiente"}
                <ArrowRight size={18} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
