import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  MapPin,
  RefreshCw,
  X,
  LoaderCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicReport } from "../api";
import type { CaseProgress, StatusDomain } from "../domain";
import { categoryName, dateLabel, newId, statusName } from "../lib";
import { ObjectArt } from "./Art";

// Una sola etiqueta con la situación del caso en palabras sencillas.
export function StatusPill({ progress }: { progress: CaseProgress }) {
  return (
    <span className={`status-pill status-${progress.tone}`}>
      {progress.short}
    </span>
  );
}

// "¿Qué sigue?": la frase que explica el momento del caso y el camino completo.
export function NextStep({
  progress,
  children,
}: {
  progress: CaseProgress;
  children?: ReactNode;
}) {
  return (
    <section className={`next-step next-${progress.tone}`} aria-live="polite">
      <p className="next-step-label">¿Qué sigue?</p>
      <p className="next-step-text">{progress.next}</p>
      {children && <div className="next-step-actions">{children}</div>}
      <ol className="case-steps">
        {progress.steps.map((step) => (
          <li key={step.label} className={`step-${step.state}`}>
            <span className="step-dot" aria-hidden="true">
              {step.state === "done" && <Check size={14} strokeWidth={3} />}
            </span>
            <span>
              {step.label}
              <span className="sr-only">
                {step.state === "done"
                  ? " (listo)"
                  : step.state === "current"
                    ? " (ahora)"
                    : " (después)"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
// En el celular, el botón «Atrás» debe cerrar la ventana abierta en lugar de
// sacar a la persona de la página (y de lo que estaba escribiendo).
function useBackButtonCloses(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const marker = newId();
    window.history.pushState(
      { ...window.history.state, localizatModal: marker },
      "",
    );
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Si se cerró con la X, Escape o un botón, retiramos la entrada que
      // agregamos. Se comprueba después de un instante: si mientras tanto la
      // ventana llevó a otra página, no se retrocede.
      window.setTimeout(() => {
        if (window.history.state?.localizatModal === marker)
          window.history.back();
      }, 0);
    };
  }, [open]);
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  closeOnBack = true,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  // Desactivar si la ventana ya depende de la dirección (p. ej. ?claim=3).
  closeOnBack?: boolean;
}) {
  useBackButtonCloses(open && closeOnBack, () => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${wide ? "dialog-wide" : ""}`}
        >
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">
            {description ?? "Revisa la información antes de continuar."}
          </Dialog.Description>
          {children}
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label="Cerrar"
          >
            <X size={21} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
// Aparición suave al bajar, hecha solo con CSS (ver .reveal en styles.css): el
// navegador la liga al desplazamiento. Sin JavaScript de por medio, el contenido
// nunca puede quedarse oculto; donde no hay soporte, simplemente se ve.
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${className} reveal`}>{children}</div>;
}
export function PageIntro({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">
          <span />
          {label}
        </p>
        <h1>{title}</h1>
        {description && <p className="intro-copy">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Tag({
  value,
  domain = "report",
}: {
  value: string;
  domain?: StatusDomain;
}) {
  return (
    <span className={`tag tag-${value}`}>{statusName(value, domain)}</span>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <p>{message}</p>
      {retry && (
        <Button variant="ghost" onClick={retry}>
          <RefreshCw size={16} /> Volver a intentar
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  text,
  children,
  category = "bag",
}: {
  title: string;
  text: string;
  children?: ReactNode;
  category?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art">
        <ObjectArt category={category} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="card-grid" aria-label="Cargando avisos" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-image" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
export function PublicCard({ report }: { report: PublicReport }) {
  return (
    <Link
      className={`public-card category-${report.category}`}
      to={`/avisos/${report.id}`}
      viewTransition
    >
      <div className="public-card-art">
        <span className={`kind-pill kind-${report.kind}`}>
          {report.kind === "found" ? "Encontrado" : "Se busca"}
        </span>
        <ObjectArt category={report.category} />
        <span className="card-art-label">ILUSTRACIÓN DE CATEGORÍA</span>
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="public-card-body">
        <span className="tiny-label">{categoryName(report.category)}</span>
        <h3>{report.public_summary}</h3>
        <div className="card-meta">
          <span>
            <MapPin size={14} />
            {report.public_area}
          </span>
          <span>
            <CalendarDays size={14} />
            {dateLabel(report.occurred_on)}
          </span>
        </div>
      </div>
    </Link>
  );
}
