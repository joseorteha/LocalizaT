import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  EyeOff,
  Globe2,
  HandHeart,
  History,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, type Kind, type Report } from "../api";
import { descriptionExample, suggestedSummary } from "../domain";
import { municipalities, publicRegion } from "../geography";
import { categories, categoryName, dateLabel, daysAgo, newId, today } from "../lib";
import { useAction } from "../hooks/useAction";
import { useDraft } from "../hooks/useDraft";
import { Button, ErrorBox, PageIntro } from "../components/ui";
import { ObjectArt } from "../components/Art";
import { PublishDialog } from "../components/PublishDialog";
import { useApp } from "../context";

const STEPS = [
  { label: "Qué pasó", hint: "Lo perdiste o lo encontraste" },
  { label: "Cómo es", hint: "Dónde, cuándo y cómo es" },
  { label: "Revisar y guardar", hint: "Qué verá la comunidad" },
];
const OTHER_PLACE = "otro";
const DRAFT_KEY = "localizat:borrador-reporte";

type PublishMode = "basic" | "detailed" | "none";
type Draft = {
  requestId: string;
  kind: Kind;
  category: string;
  step: number;
  description: string;
  municipality: string;
  place: string;
  date: string;
  publishMode: PublishMode;
  summary: string;
  publicArea: string;
};
type Field = "description" | "municipality" | "place" | "date" | "clue" | "summary" | "publicArea";
type Errors = Partial<Record<Field, string>>;

// Lugar que se guarda en el reporte: el detalle que escribió la persona y su municipio.
function reportArea(form: Draft) {
  const place = form.place.trim();
  if (form.municipality === OTHER_PLACE) return place.slice(0, 120);
  return (place ? `${place}, ${form.municipality}` : form.municipality).slice(0, 120);
}

function validate(step: number, form: Draft, clue: string): Errors {
  const errors: Errors = {};
  if (step === 1) {
    if (form.description.trim().length < 12)
      errors.description = "Escribe al menos 12 letras: por ejemplo el color, el tamaño o el material.";
    if (!form.municipality) errors.municipality = "Elige el municipio, o «Otro lugar de la Sierra».";
    if (form.municipality === OTHER_PLACE && form.place.trim().length < 3)
      errors.place = "Escribe dónde fue: la comunidad, el camino o el lugar.";
    if (!form.date) errors.date = "Elige el día, aunque sea aproximado. Puedes tocar «Hoy» o «Ayer».";
    else if (form.date > today()) errors.date = "La fecha no puede ser después de hoy.";
    if (form.kind === "lost" && clue.trim().length < 6)
      errors.clue = "Escribe un detalle secreto de al menos 6 letras.";
  }
  if (step === 2 && form.publishMode === "detailed") {
    if (form.summary.trim().length < 12) errors.summary = "Escribe al menos 12 letras para el aviso.";
    if (form.publicArea.trim().length < 3) errors.publicArea = "Escribe una zona general, como el municipio.";
  }
  return errors;
}

// Campo con su etiqueta, ayuda y mensaje de error justo debajo.
function FieldBox({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: Field;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? "field-invalid" : ""}`}>
      <label htmlFor={`campo-${name}`}>{label}</label>
      {children}
      {hint && <small id={`ayuda-${name}`}>{hint}</small>}
      {error && (
        <p className="field-error" id={`error-${name}`}>
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const fieldProps = (name: Field, errors: Errors, hasHint = true) => ({
  id: `campo-${name}`,
  "aria-invalid": errors[name] ? true : undefined,
  "aria-describedby":
    [errors[name] && `error-${name}`, hasHint && `ayuda-${name}`].filter(Boolean).join(" ") || undefined,
});

export function ReportWizard() {
  const [params] = useSearchParams();
  const draft = useDraft<Draft>(DRAFT_KEY, () => ({
    requestId: newId(),
    kind: params.get("kind") === "found" ? "found" : "lost",
    category: "bag",
    step: 0,
    description: "",
    municipality: "",
    place: "",
    date: "",
    publishMode: "basic",
    summary: "",
    publicArea: "",
  }));
  const form = draft.value;
  const update = draft.update;
  // El detalle secreto nunca se guarda en el celular: puede ser compartido.
  const [clue, setClue] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [focusField, setFocusField] = useState<Field | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const { busy, error, setError, run } = useAction();
  const [created, setCreated] = useState<Report | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const { user, sessionLoading, openAuth } = useApp();
  const stepRef = useRef<HTMLDivElement>(null);
  const step = form.step;
  const hasDraft = draft.restored && (form.description.trim() !== "" || form.place.trim() !== "");

  useEffect(() => {
    // Un borrador de pérdida se retoma en «Cómo es» para volver a escribir el detalle secreto.
    if (draft.restored && form.kind === "lost" && step === 2) update({ step: 1 });
  }, []); // Solo al abrir la página.
  useEffect(() => {
    if (step > 0) {
      stepRef.current?.focus();
      stepRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [step]);
  useEffect(() => {
    if (!focusField) return;
    document.getElementById(`campo-${focusField}`)?.focus();
    setFocusField(null);
  }, [focusField, step]);
  useEffect(() => {
    // Al terminar de crear la cuenta, el reporte se guarda sin volver a pedirlo.
    if (pendingSave && user) {
      setPendingSave(false);
      save();
    }
  }, [user, pendingSave]);

  function clearErrors(fields: Field[]) {
    if (fields.some((field) => errors[field]))
      setErrors((current) => {
        const next = { ...current };
        fields.forEach((field) => delete next[field]);
        return next;
      });
  }
  function change(changes: Partial<Draft>, fields: Field[] = []) {
    update(changes);
    clearErrors(fields);
  }
  function showErrors(found: Errors, onStep: number) {
    setErrors(found);
    if (onStep !== step) update({ step: onStep });
    setFocusField(Object.keys(found)[0] as Field);
  }

  function save() {
    // Un borrador recuperado pudo quedar incompleto: se revisa todo antes de enviar.
    const earlier = validate(1, form, clue);
    if (Object.keys(earlier).length) return showErrors(earlier, 1);
    const current = validate(2, form, clue);
    if (Object.keys(current).length) return showErrors(current, 2);
    run(async () => {
      const report = await api.createReport({
        client_request_id: form.requestId,
        kind: form.kind,
        category: form.category,
        description: form.description.trim(),
        approximate_area: reportArea(form),
        occurred_on: form.date,
        ownership_clue: form.kind === "lost" ? clue.trim() : "",
      });
      draft.clear();
      setClue("");
      if (form.publishMode === "none") {
        setCreated(report);
        return;
      }
      try {
        const result =
          form.publishMode === "detailed"
            ? await api.publish(report.id, form.summary.trim(), form.publicArea.trim())
            : await api.publishBasic(
                report.id,
                municipalities.includes(form.municipality as (typeof municipalities)[number])
                  ? form.municipality
                  : "",
              );
        setCreated({ ...report, ...result });
      } catch (caught) {
        // El reporte ya está guardado; solo falta corregir el aviso.
        setCreated(report);
        setPublishError(caught instanceof Error ? caught.message : "No pudimos enviar tu aviso.");
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const found = validate(step, form, clue);
    if (Object.keys(found).length) return showErrors(found, step);
    setErrors({});
    // Quien ya siguió adelante no necesita el aviso del borrador recuperado.
    if (hasDraft) draft.dismissRestored();
    if (step < 2) {
      if (step === 1)
        // Propuesta inicial del aviso detallado; la persona puede cambiarla.
        update({
          step: 2,
          summary: form.summary || suggestedSummary(form.kind, form.category),
          publicArea:
            form.publicArea ||
            (form.municipality === OTHER_PLACE ? form.place : form.municipality).slice(0, 80),
        });
      else update({ step: step + 1 });
      return;
    }
    if (!user) {
      setPendingSave(true);
      openAuth(`/reportar?kind=${form.kind}`, "signup");
      return;
    }
    save();
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
              Tu aviso ya se ve en la comunidad. Lo demás que escribiste sigue
              privado. Si aparece algo parecido, te avisaremos en «Novedades»
              (la campana).
            </p>
          ) : created.publication_status === "pending" ? (
            <p className="next-step-text">
              Tu aviso está esperando la revisión del equipo. Te avisaremos en
              «Novedades» (la campana).
              {created.kind === "lost"
                ? " Si aparece algo parecido, también te avisaremos."
                : " Mientras tanto, guarda el objeto."}
            </p>
          ) : (
            <p className="next-step-text">
              Tu reporte es privado: solo lo ven tú y el equipo. Aun así lo
              comparamos con los demás. Puedes publicar un aviso cuando quieras.
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

  const preview = suggestedSummary(form.kind, form.category);
  const previewArea = municipalities.includes(form.municipality as (typeof municipalities)[number])
    ? form.municipality
    : publicRegion;
  return (
    <div className="page-container">
      <PageIntro
        label="NUEVO REPORTE"
        title={form.kind === "lost" ? "Perdí algo" : "Encontré algo"}
        description="Tres pasos cortos. Lo que escribas se guarda en este celular mientras terminas. Solo necesitas una cuenta al final."
      />
      {hasDraft && (
        <div className="draft-banner" role="status">
          <History size={20} aria-hidden="true" />
          <p>
            Recuperamos el reporte que dejaste a medias.
            {form.kind === "lost" && " Por seguridad, vuelve a escribir tu detalle secreto."}
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              draft.clear();
              setClue("");
              setErrors({});
            }}
          >
            Empezar de nuevo
          </button>
        </div>
      )}
      <div className="wizard-layout">
        <aside className="wizard-sidebar">
          <span className="tiny-label">TU REPORTE, PASO A PASO</span>
          <ol>
            {STEPS.map((item, index) => (
              <li className={step === index ? "current" : step > index ? "complete" : ""} key={item.label}>
                <span>{step > index ? <Check size={16} /> : `0${index + 1}`}</span>
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
              Tu descripción y tu detalle secreto son privados. A la comunidad
              solo le llega el aviso que tú elijas en el último paso.
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
          <form className="form-stack" onSubmit={submit} noValidate>
            {step === 0 && (
              <>
                <h2>¿Qué te pasó?</h2>
                <div className="kind-choices">
                  <button type="button" aria-pressed={form.kind === "lost"} onClick={() => change({ kind: "lost" })}>
                    <Search size={25} />
                    <strong>Perdí algo</strong>
                    <span>Lo estoy buscando.</span>
                    <span className="choice-check">{form.kind === "lost" && <Check size={13} />}</span>
                  </button>
                  <button type="button" aria-pressed={form.kind === "found"} onClick={() => change({ kind: "found" })}>
                    <HandHeart size={26} />
                    <strong>Encontré algo</strong>
                    <span>Quiero devolverlo.</span>
                    <span className="choice-check">{form.kind === "found" && <Check size={13} />}</span>
                  </button>
                </div>
                <p className="category-heading" id="category-label">
                  ¿Qué tipo de objeto es?
                </p>
                <div className="category-choices" role="group" aria-labelledby="category-label">
                  {categories.map((item) => (
                    <button
                      type="button"
                      aria-pressed={form.category === item.value}
                      key={item.value}
                      onClick={() => change({ category: item.value })}
                    >
                      <ObjectArt category={item.value} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Por ahora no recibimos credenciales, documentos ni celulares;
                  solo objetos como mochilas, ropa, libros o accesorios.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <h2>
                  {form.kind === "lost" ? "Cuéntanos cómo es lo que perdiste" : "Cuéntanos cómo es lo que encontraste"}
                </h2>
                <FieldBox
                  name="description"
                  label="¿Cómo es?"
                  error={errors.description}
                  hint={`Color, tamaño, material. No se publica. ${form.description.trim().length}/300`}
                >
                  <textarea
                    {...fieldProps("description", errors)}
                    value={form.description}
                    onChange={(event) => change({ description: event.target.value }, ["description"])}
                    maxLength={300}
                    rows={3}
                    placeholder={descriptionExample(form.category)}
                  />
                </FieldBox>
                <div className="form-columns">
                  <FieldBox
                    name="municipality"
                    label="¿En qué municipio?"
                    error={errors.municipality}
                    hint="Si no estás seguro, elige el más cercano."
                  >
                    <select
                      {...fieldProps("municipality", errors)}
                      value={form.municipality}
                      onChange={(event) => change({ municipality: event.target.value }, ["municipality", "place"])}
                    >
                      <option value="">Elige el municipio</option>
                      {municipalities.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={OTHER_PLACE}>Otro lugar de la Sierra</option>
                    </select>
                  </FieldBox>
                  <FieldBox
                    name="place"
                    label={form.municipality === OTHER_PLACE ? "¿Dónde fue?" : "¿Dónde exactamente? (opcional)"}
                    error={errors.place}
                    hint="Ej.: el mercado, la cancha, el camino a la escuela. Sin dirección exacta."
                  >
                    <input
                      {...fieldProps("place", errors)}
                      value={form.place}
                      onChange={(event) => change({ place: event.target.value }, ["place"])}
                      maxLength={90}
                      autoComplete="off"
                    />
                  </FieldBox>
                </div>
                <FieldBox
                  name="date"
                  label="¿Qué día, más o menos?"
                  error={errors.date}
                  hint={form.date ? `Elegiste: ${dateLabel(form.date)}` : undefined}
                >
                  <div className="date-row">
                    <span className="quick-dates" role="group" aria-label="Elegir un día rápido">
                      {[
                        ["Hoy", today()],
                        ["Ayer", daysAgo(1)],
                        ["Antier", daysAgo(2)],
                      ].map(([label, value]) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={form.date === value}
                          onClick={() => change({ date: value }, ["date"])}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                    <input
                      {...fieldProps("date", errors, Boolean(form.date))}
                      type="date"
                      value={form.date}
                      onChange={(event) => change({ date: event.target.value }, ["date"])}
                      max={today()}
                      aria-label="Otro día"
                    />
                  </div>
                </FieldBox>
                {form.kind === "lost" ? (
                  <FieldBox
                    name="clue"
                    label="Tu detalle secreto"
                    error={errors.clue}
                    hint="Algo que solo la persona dueña sabe. No se publica ni se guarda en este celular; el equipo lo usa para comprobar que es tuyo."
                  >
                    <textarea
                      {...fieldProps("clue", errors)}
                      value={clue}
                      onChange={(event) => {
                        setClue(event.target.value);
                        clearErrors(["clue"]);
                      }}
                      maxLength={500}
                      rows={3}
                      autoComplete="off"
                      placeholder="Ej.: tiene mi nombre escrito por dentro; traía un cuaderno verde"
                    />
                  </FieldBox>
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
                <h2>Revisa y elige qué verá la comunidad</h2>
                <div className="review-summary">
                  <ObjectArt category={form.category} />
                  <div>
                    <span className="tiny-label">{form.kind === "lost" ? "LO PERDISTE" : "LO ENCONTRASTE"}</span>
                    <h3>{form.description}</h3>
                    <p>
                      {categoryName(form.category)} · {reportArea(form)} · {form.date ? dateLabel(form.date) : ""}
                    </p>
                  </div>
                  <button type="button" className="text-link" onClick={() => update({ step: 1 })}>
                    Cambiar
                  </button>
                </div>
                <fieldset className="choice-cards">
                  <legend>¿Qué quieres que vea la comunidad?</legend>
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="publishMode"
                      checked={form.publishMode === "basic"}
                      onChange={() => change({ publishMode: "basic" }, ["summary", "publicArea"])}
                    />
                    <span>
                      <strong>Un aviso básico, al momento (recomendado)</strong>
                      <small>
                        Se verá: «{preview}» · {previewArea}. Nada de lo que escribiste.
                      </small>
                    </span>
                  </label>
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="publishMode"
                      checked={form.publishMode === "detailed"}
                      onChange={() => change({ publishMode: "detailed" })}
                    />
                    <span>
                      <strong>Un aviso con mis palabras</strong>
                      <small>Puedes añadir el color o la zona. El equipo lo revisa antes de mostrarlo.</small>
                    </span>
                  </label>
                  {form.publishMode === "detailed" && (
                    <div className="choice-detail">
                      <FieldBox
                        name="summary"
                        label="¿Qué dirá el aviso?"
                        error={errors.summary}
                        hint="Algo general, como el color. Sin teléfono ni el detalle secreto."
                      >
                        <input
                          {...fieldProps("summary", errors)}
                          value={form.summary}
                          onChange={(event) => change({ summary: event.target.value }, ["summary"])}
                          maxLength={160}
                        />
                      </FieldBox>
                      <FieldBox
                        name="publicArea"
                        label="¿En qué zona?"
                        error={errors.publicArea}
                        hint="Una zona general, no la dirección exacta."
                      >
                        <input
                          {...fieldProps("publicArea", errors)}
                          value={form.publicArea}
                          onChange={(event) => change({ publicArea: event.target.value }, ["publicArea"])}
                          maxLength={80}
                        />
                      </FieldBox>
                    </div>
                  )}
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="publishMode"
                      checked={form.publishMode === "none"}
                      onChange={() => change({ publishMode: "none" }, ["summary", "publicArea"])}
                    />
                    <span>
                      <strong>Nada por ahora</strong>
                      <small>Tu reporte queda privado, pero igual lo comparamos con los demás.</small>
                    </span>
                  </label>
                </fieldset>
                {form.kind === "lost" && (
                  <p className="hint with-icon">
                    <ShieldCheck size={16} />
                    Tu detalle secreto se guarda aparte y nunca se publica.
                  </p>
                )}
                {!user && (
                  <p className="account-save-hint">
                    Para guardar te pediremos una cuenta (solo correo y
                    contraseña). Al crearla, tu reporte se guarda solo.
                  </p>
                )}
              </>
            )}
            {Object.keys(errors).length > 1 && (
              <p className="form-error-summary" role="alert">
                Revisa {Object.keys(errors).length} campos marcados en rojo.
              </p>
            )}
            {error && <ErrorBox message={error} />}
            <div className="wizard-buttons">
              {step > 0 && (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => update({ step: step - 1 })}>
                  <ArrowLeft size={17} />
                  Atrás
                </Button>
              )}
              <Button type="submit" busy={busy} disabled={step === 2 && sessionLoading}>
                {step === 2 ? (user ? "Guardar mi reporte" : "Crear cuenta y guardar") : "Siguiente"}
                <ArrowRight size={18} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
