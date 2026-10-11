import React, { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  NavigationControl,
  ScaleControl,
  setWorkerUrl
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Compass, Layers, Satellite } from "lucide-react";

// Point MapLibre to the Vite-resolved worker asset URL
setWorkerUrl(maplibreWorkerUrl);

// ── Jaipur strict geographic boundary ────────────────────────────────────────
export const JAIPUR_BOUNDS = [
  [75.48, 26.62], // Southwest [lng, lat]  (MapLibre order)
  [76.12, 27.18]  // Northeast [lng, lat]
];
// Leaflet-order aliases kept for LocationPicker compatibility
export const JAIPUR_BOUNDS_LEAFLET = [
  [26.62, 75.48],
  [27.18, 76.12]
];
export const JAIPUR_CENTER = [75.7873, 26.9124]; // [lng, lat]
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18;
export const DEFAULT_ZOOM = 12;

// ── Free OpenFreeMap style (BSD/ODbL, no API key required) ───────────────────
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Priority → hex colour mapping (mirrors CSS badge colours)
const PRIORITY_COLOURS = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e"
};

// Zone → fill/stroke colours (mirrors Leaflet ward styling)
const ZONE_COLOURS = {
  South:   { stroke: "#ec4899", fill: "#f472b6" },
  West:    { stroke: "#8b5cf6", fill: "#a78bfa" },
  East:    { stroke: "#10b981", fill: "#34d399" },
  Central: { stroke: "#f59e0b", fill: "#fbbf24" },
  default: { stroke: "#3b82f6", fill: "#60a5fa" }
};

/**
 * KindSaver interactive 3D map — powered by MapLibre GL JS (BSD-3 licence).
 * Tile provider: OpenFreeMap (free, no API key, ODbL data).
 *
 * Props mirror the former Leaflet JaipurMap exactly so MapScreen.jsx is untouched:
 *   mapData  – GeoJSON FeatureCollection of incident points
 *   wards    – GeoJSON FeatureCollection of ward polygons
 *   selectedId – id of currently selected incident
 *   onSelect   – (id) => void
 */
export function JaipurMap({ mapData, wards, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]); // { id, el, marker }[]
  const [is3D, setIs3D]             = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);
  const [mapReady, setMapReady]       = useState(false);
  const [mapError, setMapError]       = useState(null);

  // ── 1. Initialise map once ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style:     MAP_STYLE,
        center:    JAIPUR_CENTER,
        zoom:      DEFAULT_ZOOM,
        minZoom:   MIN_ZOOM,
        maxZoom:   MAX_ZOOM,
        maxBounds: JAIPUR_BOUNDS,
        pitch:     40,          // initial 3-D tilt
        bearing:   -10,
        attributionControl: false
      });
    } catch (err) {
      setMapError("WebGL is not supported by your browser. Map cannot be displayed.");
      return;
    }

    // Compact attribution bottom-left
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    // Native navigation (zoom + compass)
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    // Scale bar
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // ── 3D building extrusion (uses fill-extrusion layer if buildings present) ─
      const style = map.getStyle();
      const hasBuildingLayer = style.layers?.some(
        (l) => l.id === "building" || l.id?.includes("building")
      );
      if (hasBuildingLayer) {
        try {
          map.addLayer({
            id:   "kindsaver-3d-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: {
              "fill-extrusion-color":   "#1e293b",
              "fill-extrusion-height":  ["coalesce", ["get", "render_height"], 10],
              "fill-extrusion-base":    ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.6
            }
          });
        } catch {
          // Silently skip if source-layer mismatch
        }
      }

      // ── Satellite Imagery & Hybrid Reference Sources/Layers (Esri World Imagery) ──
      try {
        map.addSource("esri-satellite-source", {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
        });

        // Insert satellite imagery directly underneath text/road symbol labels
        const firstSymbol = style.layers?.find((l) => l.type === "symbol");

        map.addLayer(
          {
            id: "esri-satellite-layer",
            type: "raster",
            source: "esri-satellite-source",
            layout: {
              visibility: "none"
            },
            paint: {
              "raster-opacity": 1
            }
          },
          firstSymbol?.id
        );

        // Hybrid labels & boundaries overlay
        map.addSource("esri-satellite-labels-source", {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        });

        map.addLayer(
          {
            id: "esri-satellite-labels-layer",
            type: "raster",
            source: "esri-satellite-labels-source",
            layout: {
              visibility: "none"
            },
            paint: {
              "raster-opacity": 0.85
            }
          },
          firstSymbol?.id
        );
      } catch (err) {
        console.warn("Could not register satellite sources:", err);
      }

      mapRef.current = map;
      setMapReady(true);
    });

    map.on("error", (e) => {
      // Tile load errors are non-fatal; only surface style load failures
      if (e.error?.message?.includes("style")) {
        setMapError("Map style failed to load. Check your internet connection.");
      }
    });

    // Responsive auto-resize observer
    let ro = null;
    if (window.ResizeObserver && containerRef.current) {
      ro = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      ro.observe(containerRef.current);
    }

    const handleWindowResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── 2. Sync ward polygons whenever `wards` changes ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove previous ward layers & source
    ["kindsaver-ward-fill", "kindsaver-ward-stroke", "kindsaver-ward-label"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource("kindsaver-wards")) map.removeSource("kindsaver-wards");

    if (!wards?.features?.length) return;

    map.addSource("kindsaver-wards", { type: "geojson", data: wards });

    // Fill layer (semi-transparent, zone-coloured)
    map.addLayer({
      id:     "kindsaver-ward-fill",
      type:   "fill",
      source: "kindsaver-wards",
      paint:  {
        "fill-color": [
          "match", ["get", "zone"],
          "South",   ZONE_COLOURS.South.fill,
          "West",    ZONE_COLOURS.West.fill,
          "East",    ZONE_COLOURS.East.fill,
          "Central", ZONE_COLOURS.Central.fill,
          ZONE_COLOURS.default.fill
        ],
        "fill-opacity": 0.12
      }
    });

    // Stroke layer (dashed boundary)
    map.addLayer({
      id:     "kindsaver-ward-stroke",
      type:   "line",
      source: "kindsaver-wards",
      paint:  {
        "line-color": [
          "match", ["get", "zone"],
          "South",   ZONE_COLOURS.South.stroke,
          "West",    ZONE_COLOURS.West.stroke,
          "East",    ZONE_COLOURS.East.stroke,
          "Central", ZONE_COLOURS.Central.stroke,
          ZONE_COLOURS.default.stroke
        ],
        "line-width":    1.5,
        "line-dasharray": [2, 2]
      }
    });

    // Ward name label layer (visible from zoom 13+)
    map.addLayer({
      id:       "kindsaver-ward-label",
      type:     "symbol",
      source:   "kindsaver-wards",
      minzoom:  13,
      layout:   {
        "text-field":  ["concat", "Ward ", ["get", "wardNumber"], "\n", ["get", "wardName"]],
        "text-size":   11,
        "text-anchor": "center",
        "text-max-width": 8
      },
      paint: {
        "text-color":       "#e2e8f0",
        "text-halo-color":  "#0f172a",
        "text-halo-width":  1.5
      }
    });
  }, [wards, mapReady]);

  // ── 3. Sync incident markers whenever mapData / selectedId changes ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove old DOM markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];

    if (!mapData?.features?.length) return;

    mapData.features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props       = feature.properties || {};
      const id          = feature.id;
      const isSelected  = selectedId === id;
      const colour      = PRIORITY_COLOURS[props.priority] || PRIORITY_COLOURS.medium;
      const count       = props.reportCount || 1;

      // Build DOM element
      const el = document.createElement("div");
      el.className = `ks-marker ks-marker--${props.priority || "medium"}${isSelected ? " ks-marker--selected" : ""}`;
      el.title = `${props.ticketId}: ${props.title}`;
      el.innerHTML = `
        <div class="ks-marker__pulse" style="background:${colour}22;"></div>
        <div class="ks-marker__body" style="background:${colour}; box-shadow: 0 0 0 3px ${colour}44;">
          <span class="ks-marker__count">${count}</span>
        </div>
        ${isSelected ? '<div class="ks-marker__arrow"></div>' : ""}
      `;
      el.style.setProperty("--marker-color", colour);

      // Click
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onSelect) onSelect(id);
      });

      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push({ id, el, marker });
    });
  }, [mapData, selectedId, mapReady, onSelect]);

  // ── 4. Fly to selected incident ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;

    const feature = mapData?.features?.find((f) => f.id === selectedId);
    if (!feature) return;

    const [lng, lat] = feature.geometry.coordinates;
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  }, [selectedId, mapReady]);

  // ── 5. View toggles ───────────────────────────────────────────────────────
  function togglePitch() {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 40 : 0, bearing: next ? -10 : 0, duration: 700 });
  }

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;
    const next = !isSatellite;
    setIsSatellite(next);
    if (map.getLayer("esri-satellite-layer")) {
      map.setLayoutProperty("esri-satellite-layer", "visibility", next ? "visible" : "none");
    }
    if (map.getLayer("esri-satellite-labels-layer")) {
      map.setLayoutProperty("esri-satellite-labels-layer", "visibility", next ? "visible" : "none");
    }
  }

  function handleResetView() {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center:   JAIPUR_CENTER,
      zoom:     DEFAULT_ZOOM,
      pitch:    is3D ? 40 : 0,
      bearing:  is3D ? -10 : 0,
      duration: 900
    });
  }

  // ── 6. Render ─────────────────────────────────────────────────────────────
  return (
    <div className="map-canvas-container">
      {mapError ? (
        <div className="map-webgl-error">
          <span>⚠️ {mapError}</span>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="map-canvas" />

          {/* Top-Right Control Bar: Satellite & 3D */}
          <div className="map-top-right-controls">
            <button
              type="button"
              className={`map-ctrl-btn map-satellite-toggle-btn ${isSatellite ? "active" : ""}`}
              onClick={toggleSatellite}
              title={isSatellite ? "Switch to street vector map" : "Switch to high-res satellite imagery"}
            >
              <Satellite size={15} />
              <span>{isSatellite ? "Satellite" : "Street"}</span>
            </button>

            <button
              type="button"
              className={`map-ctrl-btn map-3d-toggle-btn ${is3D ? "active" : ""}`}
              onClick={togglePitch}
              title={is3D ? "Switch to flat 2D view" : "Switch to 3D view"}
            >
              <Layers size={15} />
              <span>{is3D ? "3D On" : "2D"}</span>
            </button>
          </div>

          {/* Re-centre button */}
          <button
            type="button"
            className="map-recenter-btn"
            onClick={handleResetView}
            title="Reset view to Jaipur"
          >
            <Compass size={18} />
            <span>Recenter Jaipur</span>
          </button>
        </>
      )}
    </div>
  );
}
