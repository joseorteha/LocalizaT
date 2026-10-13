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
// Con datos lentos o «ahorro de datos» se piden mosaicos normales (4 veces más ligeros que los de alta resolución).
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const LIGHT_TILES = Boolean(connection?.saveData) || /(^|-)2g|3g/.test(connection?.effectiveType ?? "");
const carto = (style: string) => [
  `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}${LIGHT_TILES ? "" : "@2x"}.png?key=${CARTO_KEY}`,
];
// Relieve real (Terrain Tiles de Mapzen en AWS Open Data). Solo se descarga en la vista 3D.
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];

type Theme = "light" | "dark";
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

const SIERRA: maplibregl.LngLatBoundsLike = [[-97.17, 18.49], [-96.97, 18.78]];
// Margen del encuadre: arriba la barra de vista, abajo la etiqueta del círculo más al sur.
const PADDING = { top: 64, bottom: 76, left: 28, right: 28 };
const PITCH_3D = 58;
const BEARING_3D = -18;
const EXAGGERATION = 1.6;
const ZOOM_BOOST = { flat: 0.25, relief: 0.75 };
// Distancia mínima en pantalla entre dos círculos (con su etiqueta); más cerca, se agrupan.
const CLUSTER_PX = 72;
const TOWN_PX = 52;

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
const foundShare = (found: number, total: number) => `${Math.round((found / Math.max(1, total)) * 100)}%`;

function sierraCamera(instance: maplibregl.Map, relief: boolean): maplibregl.CameraOptions {
  const camera = instance.cameraForBounds(SIERRA, { padding: PADDING, bearing: relief ? BEARING_3D : 0 }) ?? {};
  return {
    ...camera,
    zoom: (camera.zoom ?? 10) + (relief ? ZOOM_BOOST.relief : ZOOM_BOOST.flat),
    pitch: relief ? PITCH_3D : 0,
    bearing: relief ? BEARING_3D : 0,
  };
}

// Agrupa los municipios que quedan demasiado cerca en la pantalla actual.
type Group = { zones: MapZone[]; lngLat: [number, number]; point: maplibregl.Point };
function groupZones(instance: maplibregl.Map, zones: MapZone[]): Group[] {
  const groups: Group[] = [];
  for (const zone of [...zones].sort((a, b) => b.total - a.total)) {
    const point = instance.project(zone.coordinates);
    const near = groups.find((group) => group.point.dist(point) < CLUSTER_PX);
    if (near) {
      near.zones.push(zone);
      const weight = near.zones.reduce((sum, item) => sum + item.total, 0);
      near.lngLat = [
        near.zones.reduce((sum, item) => sum + item.coordinates[0] * item.total, 0) / weight,
        near.zones.reduce((sum, item) => sum + item.coordinates[1] * item.total, 0) / weight,
      ];
      near.point = instance.project(near.lngLat);
    } else {
      groups.push({ zones: [zone], lngLat: zone.coordinates, point });
    }
  }
  return groups;
}

function zonePopup(zone: MapZone, filters: Record<string, string>) {
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
  return popup;
}

export function MapCatalogue({ filters }: { filters: Record<string, string> }) {
  const key = new URLSearchParams(filters).toString();
  const load = useLoad(() => api.reportMap(filters), key);
  const reduced = usePrefersReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  // Plano y ligero por defecto; el relieve 3D es opcional.
  const [relief, setRelief] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState(0); // cambia al mover o acercar: vuelve a agrupar

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
        fitBoundsOptions: { padding: PADDING },
        minZoom: 8,
        maxZoom: 14,
        maxPitch: 70,
        maxBounds: [[-97.7, 18.1], [-96.4, 19.2]],
        cooperativeGestures: true,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
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
              // Oculto en la vista plana: así no se descarga el relieve.
              layout: { visibility: "none" },
              paint: {
                "hillshade-exaggeration": 0.55,
                "hillshade-shadow-color": look.shadow,
                "hillshade-highlight-color": look.highlight,
                "hillshade-accent-color": look.accent,
                "hillshade-illumination-direction": 315,
              },
            },
            { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.95 } },
          ],
        },
      });
    } catch {
      setMapError(true);
      return;
    }
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    // Un mosaico que no llega no rompe el mapa (se reintenta al moverse); se avisa en la consola.
    instance.on("error", (event) => console.warn("Mapa:", event.error?.message ?? event));
    instance.on("moveend", () => setView((value) => value + 1));
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
      markers.current = [];
      instance.remove();
      map.current = null;
    };
  }, []);

  // Vista plana ↔ relieve 3D.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    instance.setTerrain(relief ? { source: "dem", exaggeration: EXAGGERATION } : null);
    instance.setLayoutProperty("relief", "visibility", relief ? "visible" : "none");
    // Sobre el relieve los nombres del mapa base se estiran; ahí bastan nuestras etiquetas.
    instance.setLayoutProperty("labels", "visibility", relief ? "none" : "visible");
    if (relief) {
      instance.dragRotate.enable();
      instance.touchPitch.enable();
    } else {
      instance.dragRotate.disable();
      instance.touchPitch.disable();
    }
    instance.easeTo({ ...sierraCamera(instance, relief), duration: reduced ? 0 : 1400, essential: false });
  }, [relief, mapReady, reduced]);

  // Círculos: se dibujan otra vez al mover o acercar, agrupando los que se encimarían.
  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    const instance = map.current;
    if (!instance || !mapReady || !load.data) return;
    const groups = groupZones(instance, load.data.zones);
    const most = Math.max(1, ...groups.map((group) => group.zones.reduce((sum, zone) => sum + zone.total, 0)));

    for (const group of groups) {
      const total = group.zones.reduce((sum, zone) => sum + zone.total, 0);
      const found = group.zones.reduce((sum, zone) => sum + zone.found, 0);
      const size = 36 + Math.round(18 * Math.sqrt(total / most));
      // MapLibre mueve el contenedor; el botón de adentro puede crecer al pasar el cursor.
      const element = document.createElement("div");
      element.className = "map-zone-pin";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `map-zone-marker${group.zones.length > 1 ? " is-group" : ""}`;
      button.style.setProperty("--size", `${size}px`);
      button.style.setProperty("--found", foundShare(found, total));
      const count = document.createElement("span");
      count.className = "map-zone-count";
      count.textContent = String(total);
      const name = document.createElement("span");
      name.className = "map-zone-name";
      button.append(count, name);
      element.append(button);
      // Aunque una montaña lo tape, el círculo se sigue viendo.
      const marker = new maplibregl.Marker({ element, opacityWhenCovered: "0.9" }).setLngLat(group.lngLat);

      if (group.zones.length === 1) {
        const zone = group.zones[0];
        name.textContent = zone.name;
        button.dataset.zone = zone.name;
        button.setAttribute("aria-label", `${zone.name}: ${zoneSummary(zone)}`);
        marker.setPopup(
          new maplibregl.Popup({ offset: size / 2 + 6, maxWidth: "280px", className: "map-popup-shell" }).setDOMContent(zonePopup(zone, filters)),
        );
      } else {
        // Grupo: al tocarlo, el mapa se acerca hasta separar los municipios.
        name.textContent = `${group.zones.length} municipios`;
        button.setAttribute("aria-label", `${group.zones.map((zone) => zone.name).join(", ")}: ${plural(total, "aviso", "avisos")}. Toca para acercar.`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const bounds = new maplibregl.LngLatBounds();
          group.zones.forEach((zone) => bounds.extend(zone.coordinates));
          instance.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: reduced ? 0 : 800 });
        });
      }
      markers.current.push(marker.addTo(instance));
    }

    // Cabeceras sin avisos: puntos de contexto, solo donde no estorban.
    const taken = groups.map((group) => group.point);
    const withNotices = new Set(load.data.zones.map((zone) => zone.name));
    for (const town of load.data.municipalities ?? []) {
      if (withNotices.has(town.name)) continue;
      const point = instance.project(town.coordinates);
      if (taken.some((other) => other.dist(point) < TOWN_PX)) continue;
      taken.push(point);
      const element = document.createElement("div");
      element.className = "map-town";
      element.setAttribute("aria-hidden", "true");
      // En la vista plana el mapa base ya escribe el nombre del pueblo: basta el punto.
      if (relief) {
        const label = document.createElement("span");
        label.textContent = town.name;
        element.append(label);
      }
      markers.current.push(
        new maplibregl.Marker({ element, anchor: "top", opacityWhenCovered: "0.85" }).setLngLat(town.coordinates).addTo(instance),
      );
    }
  }, [load.data, mapReady, key, view, reduced, relief]);

  // Pasar el cursor por una tarjeta de la lista resalta su círculo en el mapa.
  useEffect(() => {
    markers.current.forEach((marker) => {
      const button = marker.getElement().querySelector<HTMLElement>(".map-zone-marker");
      button?.classList.toggle("is-active", Boolean(active) && button.dataset.zone === active);
    });
  }, [active, view]);

  function showSierra() {
    const instance = map.current;
    if (instance) instance.easeTo({ ...sierraCamera(instance, relief), duration: reduced ? 0 : 1000 });
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
          <div className="map-toolbar" role="group" aria-label="Vista del mapa">
            <button type="button" aria-pressed={!relief} onClick={() => setRelief(false)}>
              <MapIcon size={16} aria-hidden="true" /> Plano
            </button>
            <button type="button" aria-pressed={relief} onClick={() => setRelief(true)}>
              <Mountain size={16} aria-hidden="true" /> Relieve
            </button>
            <button type="button" onClick={showSierra} aria-label="Ver toda la Sierra">
              <LocateFixed size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {mapError && <div className="map-unavailable">El mapa visual no está disponible en este navegador. Puedes usar la lista de zonas de abajo.</div>}
      </div>
      {!mapError && (
        <div className="map-legend" aria-hidden="true">
          <span><i className="is-lost" /> Se buscan</span>
          <span><i className="is-found" /> Encontrados</span>
          <span><i className="is-group" /> Varios municipios: toca para acercar</span>
        </div>
      )}
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
                style={{ "--found": foundShare(zone.found, zone.total) } as CSSProperties}
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
