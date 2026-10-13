import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Mountain, Map as MapIcon, LocateFixed } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { Marker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { api, type MapZone } from "../../api";
import { useLoad, usePrefersReducedMotion } from "../../lib";
import { ErrorBox } from "../../components/ui";

maplibregl.setWorkerUrl(mapWorkerUrl);

// Mapa base de CARTO. La clave va en cada mosaico que pide el navegador (no es
// secreta); conviene limitarla al dominio de LocalizaT en el panel de CARTO.
const CARTO_KEY = (import.meta.env.VITE_CARTO_KEY as string | undefined) || "cb1_4inn_1_702e23b375ac1a1ab43bfa92";
const carto = (style: string) => [`https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`];
// Relieve real (Terrain Tiles de Mapzen en AWS Open Data): las montañas de la Sierra.
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];

type Theme = "light" | "dark";
// El relieve se pinta entre el mapa sin nombres y una capa solo con nombres,
// para que la sombra de las montañas no tape las etiquetas.
const LOOK: Record<Theme, {
  base: string;
  labels: string;
  shadow: string;
  highlight: string;
  accent: string;
  sky: maplibregl.SkySpecification;
}> = {
  light: {
    base: "voyager_nolabels",
    labels: "voyager_only_labels",
    shadow: "#0a3640",
    highlight: "#ffffff",
    accent: "#4f7a5a",
    sky: {
      "sky-color": "#9fd3dc",
      "horizon-color": "#eef6f3",
      "fog-color": "#eef6f3",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.35,
      "atmosphere-blend": 0.6,
    },
  },
  dark: {
    base: "dark_nolabels",
    labels: "dark_only_labels",
    shadow: "#000000",
    highlight: "#5cc8d6",
    accent: "#0e4e5a",
    sky: {
      "sky-color": "#06252b",
      "horizon-color": "#0e4e5a",
      "fog-color": "#061a1f",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.4,
      "atmosphere-blend": 0.5,
    },
  },
};
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

const SIERRA: maplibregl.LngLatBoundsLike = [[-97.17, 18.5], [-96.97, 18.78]];
const PITCH_3D = 58;
const BEARING_3D = -18;
const EXAGGERATION = 1.6;
// Los municipios están cerca entre sí: la cámara se acerca un poco más que el
// encuadre de la región para que los círculos no se encimen.
const ZOOM_BOOST = { flat: 0.35, relief: 0.75 };

const SPANISH: Record<string, string> = {
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Volver al norte",
  "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda del ratón para acercar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + rueda del ratón para acercar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
  "AttributionControl.ToggleAttribution": "Créditos del mapa",
};

function zoneLink(zone: MapZone, filters: Record<string, string>) {
  const next = new URLSearchParams(filters);
  next.delete("view");
  next.set("area", zone.name);
  next.delete("page");
  return `/explorar?${next}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const zoneSummary = (zone: MapZone) =>
  `${plural(zone.total, "aviso", "avisos")} · ${plural(zone.lost, "se busca", "se buscan")} · ${plural(zone.found, "encontrado", "encontrados")}`;

// Cámara que encuadra la Sierra, plana o inclinada.
function sierraCamera(instance: maplibregl.Map, relief: boolean): maplibregl.CameraOptions {
  const camera = instance.cameraForBounds(SIERRA, { padding: 40, bearing: relief ? BEARING_3D : 0 }) ?? {};
  return {
    ...camera,
    zoom: (camera.zoom ?? 10) + (relief ? ZOOM_BOOST.relief : ZOOM_BOOST.flat),
    pitch: relief ? PITCH_3D : 0,
    bearing: relief ? BEARING_3D : 0,
  };
}

export function MapCatalogue({ filters }: { filters: Record<string, string> }) {
  const key = new URLSearchParams(filters).toString();
  const load = useLoad(() => api.reportMap(filters), key);
  const reduced = usePrefersReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const towns = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  // En computadora abre en 3D; en el celular, plano (menos datos y batería).
  const [relief, setRelief] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) {
      setMapError(true);
      return;
    }
    let instance: maplibregl.Map;
    const look = LOOK[currentTheme()];
    try {
      instance = new maplibregl.Map({
        container: container.current,
        bounds: SIERRA,
        fitBoundsOptions: { padding: 40 },
        minZoom: 8,
        maxZoom: 14,
        maxPitch: 70,
        maxBounds: [[-97.7, 18.1], [-96.4, 19.2]],
        cooperativeGestures: true,
        attributionControl: false,
        locale: SPANISH,
        style: {
          version: 8,
          sources: {
            base: { type: "raster", tiles: carto(look.base), tileSize: 256, attribution: "© OpenStreetMap, © CARTO" },
            labels: { type: "raster", tiles: carto(look.labels), tileSize: 256 },
            hills: { type: "raster-dem", tiles: DEM_TILES, tileSize: 256, encoding: "terrarium", maxzoom: 12, attribution: "Relieve: Mapzen, AWS Open Data" },
            dem: { type: "raster-dem", tiles: DEM_TILES, tileSize: 256, encoding: "terrarium", maxzoom: 12 },
          },
          sky: look.sky,
          layers: [
            { id: "base", type: "raster", source: "base" },
            {
              id: "relief",
              type: "hillshade",
              source: "hills",
              paint: {
                "hillshade-exaggeration": 0.55,
                "hillshade-shadow-color": look.shadow,
                "hillshade-highlight-color": look.highlight,
                "hillshade-accent-color": look.accent,
                "hillshade-illumination-direction": 315,
              },
            },
            { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.92 } },
          ],
        },
      });
    } catch {
      setMapError(true);
      return;
    }
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    // Un mosaico que no llega no rompe el mapa (se reintenta al moverse); se avisa en la consola.
    instance.on("error", (event) => console.warn("Mapa:", event.error?.message ?? event));
    // Listo en cuanto el estilo está armado: no hace falta esperar a que bajen los mosaicos.
    if (instance.isStyleLoaded()) setMapReady(true);
    else instance.once("style.load", () => setMapReady(true));
    map.current = instance;

    // Modo claro u oscuro: cambia el mapa base, la sombra del relieve y el cielo.
    const applyTheme = () => {
      const next = LOOK[currentTheme()];
      (instance.getSource("base") as maplibregl.RasterTileSource | undefined)?.setTiles(carto(next.base));
      (instance.getSource("labels") as maplibregl.RasterTileSource | undefined)?.setTiles(carto(next.labels));
      instance.setPaintProperty("relief", "hillshade-shadow-color", next.shadow);
      instance.setPaintProperty("relief", "hillshade-highlight-color", next.highlight);
      instance.setPaintProperty("relief", "hillshade-accent-color", next.accent);
      instance.setSky(next.sky);
    };
    const themeObserver = new MutationObserver(() => {
      if (instance.isStyleLoaded()) applyTheme();
      else instance.once("style.load", applyTheme);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      themeObserver.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      towns.current.forEach((marker) => marker.remove());
      towns.current = [];
      instance.remove();
      map.current = null;
    };
  }, []);

  // Relieve 3D: el terreno se levanta y la cámara se inclina sobre la Sierra.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    instance.setTerrain(relief ? { source: "dem", exaggeration: EXAGGERATION } : null);
    // Sobre el relieve los nombres del mapa base se estiran; ahí bastan nuestras etiquetas.
    instance.setLayoutProperty("labels", "visibility", relief ? "none" : "visible");
    instance.easeTo({ ...sierraCamera(instance, relief), duration: reduced ? 0 : 2200, essential: false });
  }, [relief, mapReady, reduced]);

  // Cabeceras sin avisos: puntos pequeños que dan contexto de la región.
  useEffect(() => {
    towns.current.forEach((marker) => marker.remove());
    towns.current = [];
    const instance = map.current;
    if (!instance || !mapReady || !load.data) return;
    const withNotices = new Set(load.data.zones.map((zone) => zone.name));
    for (const town of load.data.municipalities ?? []) {
      if (withNotices.has(town.name)) continue;
      const element = document.createElement("div");
      element.className = "map-town";
      element.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = town.name;
      element.append(label);
      towns.current.push(
        new maplibregl.Marker({ element, anchor: "top", opacityWhenCovered: "0.85" }).setLngLat(town.coordinates).addTo(instance),
      );
    }
  }, [load.data, mapReady]);

  // Municipios con avisos: el anillo muestra cuántos se buscan y cuántos se encontraron.
  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();
    const instance = map.current;
    if (!instance || !mapReady || !load.data) return;
    const most = Math.max(1, ...load.data.zones.map((zone) => zone.total));
    for (const zone of load.data.zones) {
      // MapLibre mueve el contenedor; el botón de adentro puede crecer al pasar el cursor.
      const element = document.createElement("div");
      element.className = "map-zone-pin";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-zone-marker";
      const size = 38 + Math.round(20 * Math.sqrt(zone.total / most));
      button.style.setProperty("--size", `${size}px`);
      button.style.setProperty("--found", `${Math.round((zone.found / zone.total) * 100)}%`);
      button.setAttribute("aria-label", `${zone.name}: ${zoneSummary(zone)}`);
      const count = document.createElement("span");
      count.className = "map-zone-count";
      count.textContent = String(zone.total);
      const name = document.createElement("span");
      name.className = "map-zone-name";
      name.textContent = zone.name;
      button.append(count, name);
      element.append(button);

      const popup = document.createElement("div");
      popup.className = "map-popup";
      const title = document.createElement("strong");
      title.textContent = zone.name;
      const stats = document.createElement("div");
      stats.className = "map-popup-stats";
      for (const [value, label, kind] of [
        [zone.lost, zone.lost === 1 ? "se busca" : "se buscan", "lost"],
        [zone.found, zone.found === 1 ? "encontrado" : "encontrados", "found"],
      ] as const) {
        const stat = document.createElement("span");
        stat.className = `map-popup-stat is-${kind}`;
        const number = document.createElement("b");
        number.textContent = String(value);
        stat.append(number, ` ${label}`);
        stats.append(stat);
      }
      const link = document.createElement("a");
      link.href = zoneLink(zone, filters);
      link.className = "map-popup-link";
      link.textContent = `Ver los avisos de ${zone.name} →`;
      const note = document.createElement("small");
      note.textContent = "El círculo marca la cabecera municipal, no dónde está el objeto.";
      popup.append(title, stats, link, note);

      // Aunque una montaña lo tape, el círculo se sigue viendo.
      const marker = new maplibregl.Marker({ element, opacityWhenCovered: "0.9" })
        .setLngLat(zone.coordinates)
        .setPopup(new maplibregl.Popup({ offset: size / 2 + 6, maxWidth: "280px", className: "map-popup-shell" }).setDOMContent(popup))
        .addTo(instance);
      element.addEventListener("click", () => {
        instance.easeTo({ center: zone.coordinates, zoom: Math.max(instance.getZoom(), 11), duration: reduced ? 0 : 900 });
      });
      markers.current.set(zone.name, marker);
    }
  }, [load.data, mapReady, key, reduced]);

  // Pasar el cursor por una tarjeta de la lista resalta su círculo en el mapa.
  useEffect(() => {
    markers.current.forEach((marker, name) =>
      marker.getElement().querySelector(".map-zone-marker")?.classList.toggle("is-active", name === active),
    );
  }, [active]);

  function showSierra() {
    const instance = map.current;
    if (!instance) return;
    instance.easeTo({ ...sierraCamera(instance, relief), duration: reduced ? 0 : 1200 });
  }

  const zones = load.data?.zones ?? [];
  const total = zones.reduce((sum, zone) => sum + zone.total, 0);
  return (
    <section className="map-catalogue" aria-label="Mapa de avisos por municipio">
      <div className="map-catalogue-intro">
        <div>
          <h2>Avisos en la Sierra</h2>
          <p>
            Cada círculo es una cabecera municipal, <strong>no la ubicación del objeto ni de una persona</strong>.
          </p>
        </div>
        <span>{plural(total, "aviso con municipio", "avisos con municipio")}</span>
      </div>
      <div className={`map-frame ${relief ? "is-3d" : ""}`}>
        <div ref={container} className="map-canvas" aria-hidden={mapError} />
        {!mapError && (
          <>
            <div className="map-toolbar" role="group" aria-label="Vista del mapa">
              <button type="button" aria-pressed={relief} onClick={() => setRelief(true)}>
                <Mountain size={16} aria-hidden="true" /> Relieve 3D
              </button>
              <button type="button" aria-pressed={!relief} onClick={() => setRelief(false)}>
                <MapIcon size={16} aria-hidden="true" /> Plano
              </button>
              <button type="button" onClick={showSierra} aria-label="Ver toda la Sierra">
                <LocateFixed size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="map-legend" aria-hidden="true">
              <span><i className="is-lost" /> Se buscan</span>
              <span><i className="is-found" /> Encontrados</span>
              <span><i className="is-town" /> Cabecera sin avisos</span>
            </div>
          </>
        )}
        {mapError && <div className="map-unavailable">El mapa visual no está disponible en este navegador. Puedes usar la lista de zonas de abajo.</div>}
      </div>
      {load.error ? <ErrorBox message={load.error} retry={load.reload} /> : load.loading ? (
        <p className="loading-message">Cargando zonas…</p>
      ) : (
        <>
          <div className="map-zone-list">
            {zones.map((zone) => (
              <Link
                to={zoneLink(zone, filters)}
                key={zone.name}
                onMouseEnter={() => setActive(zone.name)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(zone.name)}
                onBlur={() => setActive(null)}
                style={{ "--found": `${Math.round((zone.found / zone.total) * 100)}%` } as CSSProperties}
              >
                <span className="map-zone-ring" aria-hidden="true" />
                <strong>{zone.name}</strong>
                <span>{zoneSummary(zone)}</span>
              </Link>
            ))}
          </div>
          {load.data?.without_municipality ? (
            <p className="map-region-note">
              {load.data.without_municipality} {load.data.without_municipality === 1 ? "aviso indica" : "avisos indican"} solo la región u otra zona. Están en la vista de lista.
            </p>
          ) : null}
          {!zones.length && !load.data?.without_municipality && <p className="map-region-note">Todavía no hay avisos con esos filtros.</p>}
        </>
      )}
      <p className="map-attribution-note">
        Cartografía © OpenStreetMap, © CARTO. Relieve: Mapzen y AWS Open Data. Cabeceras municipales: INEGI, cuadro 1.2 de Veracruz.
      </p>
    </section>
  );
}
