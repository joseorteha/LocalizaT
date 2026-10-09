import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import type { Marker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { api, type MapZone } from "../../api";
import { useLoad } from "../../lib";
import { ErrorBox } from "../../components/ui";

maplibregl.setWorkerUrl(mapWorkerUrl);

// Mapa base limpio y minimalista (CARTO), para que no compita con los avisos.
// Se adapta al tema: claro en modo claro, oscuro en modo oscuro.
const TILE_OVERRIDE = import.meta.env.VITE_MAP_TILE_URL as string | undefined;
const BASEMAPS: Record<"light" | "dark", string[]> = {
  light: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`),
  dark: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`),
};
const currentTheme = (): "light" | "dark" =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const basemapTiles = (theme: "light" | "dark"): string[] =>
  TILE_OVERRIDE ? [TILE_OVERRIDE] : BASEMAPS[theme];

function zoneLink(zone: MapZone, filters: Record<string, string>) {
  const next = new URLSearchParams(filters);
  next.delete("view");
  next.set("area", zone.name);
  next.delete("page");
  return `/explorar?${next}`;
}

export function MapCatalogue({ filters }: { filters: Record<string, string> }) {
  const key = new URLSearchParams(filters).toString();
  const load = useLoad(() => api.reportMap(filters), key);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!container.current) {
      setMapError(true);
      return;
    }
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        center: [-97.07, 18.66],
        zoom: 9,
        minZoom: 8,
        maxZoom: 13,
        maxBounds: [[-97.7, 18.1], [-96.4, 19.2]],
        scrollZoom: false,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            terrain: {
              type: "raster",
              tiles: basemapTiles(currentTheme()),
              tileSize: 256,
              attribution: "© OpenStreetMap, © CARTO",
            },
          },
          layers: [{ id: "terrain", type: "raster", source: "terrain" }],
        },
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.current = instance;
      setMapReady(true);
      // Cambiar el mapa base cuando la persona cambia entre modo claro y oscuro.
      const applyTheme = () => {
        const source = instance.getSource("terrain") as maplibregl.RasterTileSource | undefined;
        source?.setTiles(basemapTiles(currentTheme()));
      };
      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => {
        themeObserver.disconnect();
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];
        instance.remove();
        map.current = null;
      };
    } catch {
      setMapError(true);
    }
  }, []);

  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    if (!map.current || !load.data) return;
    for (const zone of load.data.zones) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "map-zone-marker";
      element.textContent = String(zone.total);
      element.setAttribute("aria-label", `${zone.name}: ${zone.total} ${zone.total === 1 ? "aviso" : "avisos"}`);
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = zone.name;
      const detail = document.createElement("p");
      detail.textContent = `${zone.lost} se buscan · ${zone.found} encontrados`;
      const link = document.createElement("a");
      link.href = zoneLink(zone, filters);
      link.textContent = "Ver avisos de esta zona →";
      popup.append(title, detail, link);
      markers.current.push(new maplibregl.Marker({ element })
        .setLngLat(zone.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 19 }).setDOMContent(popup))
        .addTo(map.current));
    }
  }, [load.data, mapReady, key]);

  const zones = load.data?.zones ?? [];
  return (
    <section className="map-catalogue" aria-label="Mapa de avisos por municipio">
      <div className="map-catalogue-intro">
        <div>
          <h2>Avisos por municipio</h2>
          <p>Los círculos representan la cabecera municipal, <strong>no la ubicación del objeto ni de una persona</strong>.</p>
        </div>
        <span>{zones.reduce((sum, zone) => sum + zone.total, 0)} {zones.reduce((sum, zone) => sum + zone.total, 0) === 1 ? "aviso" : "avisos"} con municipio</span>
      </div>
      <div className="map-frame">
        <div ref={container} className="map-canvas" aria-hidden={mapError} />
        {mapError && <div className="map-unavailable">El mapa visual no está disponible en este navegador. Puedes usar la lista de zonas de abajo.</div>}
      </div>
      {load.error ? <ErrorBox message={load.error} retry={load.reload} /> : load.loading ? (
        <p className="loading-message">Cargando zonas…</p>
      ) : (
        <>
          <div className="map-zone-list">
            {zones.map((zone) => (
              <Link to={zoneLink(zone, filters)} key={zone.name}>
                <strong>{zone.name}</strong>
                <span>{zone.total} {zone.total === 1 ? "aviso" : "avisos"} · {zone.lost} se buscan · {zone.found} encontrados</span>
              </Link>
            ))}
          </div>
          {load.data?.without_municipality ? (
            <p className="map-region-note">
              {load.data.without_municipality} {load.data.without_municipality === 1 ? "aviso indica" : "avisos indican"} solo la región u otra zona. Están disponibles en la vista de lista.
            </p>
          ) : null}
          {!zones.length && !load.data?.without_municipality && <p className="map-region-note">Todavía no hay avisos con esos filtros.</p>}
        </>
      )}
      <p className="map-attribution-note">Cartografía © OpenStreetMap, © CARTO. Referencias municipales: INEGI, cuadro 1.2 de Veracruz.</p>
    </section>
  );
}
