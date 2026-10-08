import { lazy, Suspense, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "../../api";
import { categories, useLoad } from "../../lib";
import {
  Button,
  EmptyState,
  ErrorBox,
  PageIntro,
  PublicCard,
  SkeletonCards,
} from "../../components/ui";

const MapCatalogue = lazy(() => import("./MapCatalogue").then((module) => ({ default: module.MapCatalogue })));

export function Explore() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params.entries());
  const { data, loading, error, reload } = useLoad(
    () => api.publicReports(filters),
    params.toString(),
  );
  const [advanced, setAdvanced] = useState(false);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update("q", String(new FormData(event.currentTarget).get("q") ?? ""));
  }
  return (
    <div className="page-container">
      <PageIntro
        label="AVISOS DE LA COMUNIDAD"
        title={
          params.get("kind") === "found"
            ? "Objetos encontrados"
            : params.get("kind") === "lost"
              ? "Objetos que se buscan"
              : "Objetos perdidos y encontrados"
        }
        description={
          params.get("kind") === "found"
            ? "Si reconoces tu objeto, abre el aviso y solicita su devolución. El equipo revisará tu propiedad antes de coordinar la entrega."
            : "Encontrados: objetos que alguien quiere devolver. Se buscan: objetos que alguien perdió. Elige el tipo de aviso para revisar."
        }
      >
        <div className="intro-stamp">
          <ShieldCheck size={25} />
          <span>
            Solo datos generales
            <br />
            en cada aviso
          </span>
        </div>
      </PageIntro>
      <div className="explore-controls">
        <form className="search-box" onSubmit={search}>
          <Search size={21} />
          <input
            name="q"
            placeholder="¿Qué estás buscando?"
            defaultValue={params.get("q") ?? ""}
            aria-label="Buscar avisos"
            maxLength={80}
          />
          <button type="submit" className="search-submit" aria-label="Buscar">
            <ArrowRight size={20} />
          </button>
        </form>
        <button
          type="button"
          className="btn btn-secondary filter-toggle"
          aria-expanded={advanced}
          onClick={() => setAdvanced((value) => !value)}
        >
          <SlidersHorizontal size={18} />
          Filtros
          {Object.keys(filters).filter((key) => key !== "page" && key !== "view").length > 0 && (
            <span className="filter-count">
              {Object.keys(filters).filter((key) => key !== "page" && key !== "view").length}
            </span>
          )}
        </button>
      </div>
      <div className="catalogue-toolbar">
        <div className="segmented" aria-label="Tipo de aviso">
          {[
            ["", "Todos los avisos"],
            ["found", "Encontrados"],
            ["lost", "Se buscan"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={(params.get("kind") ?? "") === value}
              onClick={() => update("kind", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-select">
          <span className="sr-only">Categoría</span>
          <select
            value={params.get("category") ?? ""}
            onChange={(event) => update("category", event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" aria-label="Vista de avisos">
          <button aria-pressed={params.get("view") !== "map"} onClick={() => update("view", "")}>Lista</button>
          <button aria-pressed={params.get("view") === "map"} onClick={() => update("view", "map")}>Mapa</button>
        </div>
      </div>
      {advanced && (
        <div className="advanced-filters">
          <label>
            Localidad o zona
            <input
              value={params.get("area") ?? ""}
              onChange={(event) => update("area", event.target.value)}
              placeholder="Ej. Zongolica, Tequila…"
              maxLength={80}
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              value={params.get("from") ?? ""}
              onChange={(event) => update("from", event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={params.get("to") ?? ""}
              onChange={(event) => update("to", event.target.value)}
            />
          </label>
          <Button variant="ghost" onClick={() => setParams({})}>
            Limpiar filtros
          </Button>
        </div>
      )}
      <div className="results-label" aria-live="polite">
        {loading
          ? "Buscando avisos…"
          : `${data?.count ?? 0} ${(data?.count ?? 0) === 1 ? "aviso disponible" : "avisos disponibles"}`}
        <span>Información pública · Datos personales reservados</span>
      </div>
      {params.get("view") === "map" ? (
        <Suspense fallback={<p className="loading-message">Abriendo mapa…</p>}>
          <MapCatalogue filters={filters} />
        </Suspense>
      ) : loading ? (
        <SkeletonCards count={6} />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : data?.results.length ? (
        <>
          <div className="card-grid">
            {data.results.map((report) => (
              <PublicCard key={report.id} report={report} />
            ))}
          </div>
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={!data.previous}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set(
                  "page",
                  String(Math.max(1, Number(params.get("page") ?? 1) - 1)),
                );
                setParams(next);
              }}
            >
              <ArrowLeft size={16} />
              Anterior
            </Button>
            <span>Página {params.get("page") ?? "1"}</span>
            <Button
              variant="secondary"
              disabled={!data.next}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("page", String(Number(params.get("page") ?? 1) + 1));
                setParams(next);
              }}
            >
              Siguiente
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          title={
            Object.keys(filters).length
              ? "Aún no encontramos un aviso con esos datos."
              : "Todavía no hay avisos publicados."
          }
          text="Puedes cambiar los filtros o registrar tu objeto. Cuando se apruebe un aviso compatible, habrá una nueva posibilidad."
        >
          {Object.keys(filters).length > 0 && (
            <Button variant="secondary" onClick={() => setParams({})}>
              Ver todos los avisos
            </Button>
          )}
          <Link className="btn btn-primary" to="/reportar">
            Registrar mi objeto <ArrowRight size={17} />
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
