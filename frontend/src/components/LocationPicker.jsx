import React, { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CheckCircle2, HelpCircle, Layers, Loader2, MapPin, Navigation, Satellite } from "lucide-react";
import { apiGet } from "../api.js";
import { JAIPUR_BOUNDS, JAIPUR_CENTER, MAX_ZOOM, MIN_ZOOM } from "./JaipurMap.jsx";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_COORDS = [26.8543, 75.8069]; // [lat, lng] Malviya Nagar default

// Expanded camera bounds preventing tile cut-off when tilted in 3D perspective
const JAIPUR_CAMERA_BOUNDS = [
  [75.25, 26.40],
  [76.35, 27.40]
];

export function LocationPicker({ lat, lng, gpsAccuracyMeters, onChange, onWardDetected }) {
  const mapRef = useRef(null);
  const nodeRef = useRef(null);
  const markerRef = useRef(null);

  const [is3D, setIs3D] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [detectingWard, setDetectingWard] = useState(false);
  const [detectedWard, setDetectedWard] = useState(null);
  const [detectError, setDetectError] = useState("");

  const currentLat = Number(lat) || DEFAULT_COORDS[0];
  const currentLng = Number(lng) || DEFAULT_COORDS[1];

  // ── 1. Initialize MapLibre Map restricted to Jaipur ───────────────────────
  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;

    let map;
    try {
      map = new MapLibreMap({
        container: nodeRef.current,
        style: MAP_STYLE,
        center: [currentLng, currentLat],
        zoom: 14,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: JAIPUR_CAMERA_BOUNDS,
        pitch: 0,
        bearing: 0,
        attributionControl: false
      });
    } catch (err) {
      console.warn("LocationPicker MapLibre init error:", err);
      return;
    }

    // Native navigation (zoom + pitch compass)
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    // Draggable pinpoint marker
    const pinEl = document.createElement("div");
    pinEl.className = "picker-pin";
    pinEl.innerHTML = `<span class="pin-pulse"></span><span class="pin-dot"></span>`;

    const marker = new Marker({
      element: pinEl,
      draggable: true
    })
      .setLngLat([currentLng, currentLat])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      const clamped = clampToBounds(lngLat.lat, lngLat.lng);
      marker.setLngLat([clamped.lng, clamped.lat]);
      updatePosition(clamped.lat, clamped.lng, 10);
    });

    map.on("click", (e) => {
      const clamped = clampToBounds(e.lngLat.lat, e.lngLat.lng);
      marker.setLngLat([clamped.lng, clamped.lat]);
      updatePosition(clamped.lat, clamped.lng, 10);
    });

    map.on("load", () => {
      const style = map.getStyle();

      // ── 3D Buildings ───────────────────────────────────────────────────────
      const hasBuildingLayer = style.layers?.some(
        (l) => l.id === "building" || l.id?.includes("building")
      );
      if (hasBuildingLayer) {
        try {
          map.addLayer({
            id: "picker-3d-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#1e293b",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 10],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.6
            }
          });
        } catch {
          // ignore
        }
      }

      // ── Satellite Imagery & Hybrid Labels (Esri World Imagery) ──────────────
      try {
        map.addSource("picker-satellite-source", {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        });

        const firstSymbol = style.layers?.find((l) => l.type === "symbol");

        map.addLayer(
          {
            id: "picker-satellite-layer",
            type: "raster",
            source: "picker-satellite-source",
            layout: { visibility: "none" },
            paint: { "raster-opacity": 1 }
          },
          firstSymbol?.id
        );

        map.addSource("picker-satellite-labels-source", {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        });

        map.addLayer(
          {
            id: "picker-satellite-labels-layer",
            type: "raster",
            source: "picker-satellite-labels-source",
            layout: { visibility: "none" },
            paint: { "raster-opacity": 0.85 }
          },
          firstSymbol?.id
        );
      } catch (err) {
        console.warn("Could not register satellite in LocationPicker:", err);
      }

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);

      // Force canvas size sync to completely avoid black borders
      map.resize();
      requestAnimationFrame(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 150);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 500);
    });

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined" && nodeRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      resizeObserver.observe(nodeRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Clamp lat/lng to stay strictly within Jaipur boundaries
  function clampToBounds(targetLat, targetLng) {
    const [[minLng, minLat], [maxLng, maxLat]] = JAIPUR_BOUNDS;
    return {
      lat: Math.max(minLat, Math.min(maxLat, targetLat)),
      lng: Math.max(minLng, Math.min(maxLng, targetLng))
    };
  }

  function isWithinJaipur(targetLat, targetLng) {
    const [[minLng, minLat], [maxLng, maxLat]] = JAIPUR_BOUNDS;
    return targetLat >= minLat && targetLat <= maxLat && targetLng >= minLng && targetLng <= maxLng;
  }

  // Update marker position when props change from outside
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const markerPos = markerRef.current.getLngLat();
    if (Math.abs(markerPos.lat - currentLat) > 0.0001 || Math.abs(markerPos.lng - currentLng) > 0.0001) {
      markerRef.current.setLngLat([currentLng, currentLat]);
      mapRef.current.easeTo({ center: [currentLng, currentLat], duration: 400 });
    }
    detectWardAt(currentLat, currentLng);
  }, [lat, lng]);

  function updatePosition(newLat, newLng, accuracy) {
    const roundedLat = Number(newLat.toFixed(6));
    const roundedLng = Number(newLng.toFixed(6));
    onChange({
      lat: String(roundedLat),
      lng: String(roundedLng),
      gpsAccuracyMeters: accuracy || 10
    });
    detectWardAt(roundedLat, roundedLng);
  }

  async function detectWardAt(targetLat, targetLng) {
    setDetectingWard(true);
    setDetectError("");
    try {
      const res = await apiGet(`/api/wards/detect`, { lat: targetLat, lng: targetLng });
      setDetectedWard(res.ward || null);
      if (onWardDetected) onWardDetected(res.ward || null);
    } catch {
      setDetectedWard(null);
      setDetectError("Outside mapped ward boundary. Municipal teams will route via nearest zone.");
      if (onWardDetected) onWardDetected(null);
    } finally {
      setDetectingWard(false);
    }
  }

  // ── View Toggles ──────────────────────────────────────────────────────────
  function togglePitch() {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 40 : 0, duration: 600 });
  }

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;
    const next = !isSatellite;
    setIsSatellite(next);
    if (map.getLayer("picker-satellite-layer")) {
      map.setLayoutProperty("picker-satellite-layer", "visibility", next ? "visible" : "none");
    }
    if (map.getLayer("picker-satellite-labels-layer")) {
      map.setLayoutProperty("picker-satellite-labels-layer", "visibility", next ? "visible" : "none");
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;

        if (!isWithinJaipur(latitude, longitude)) {
          alert("Your device location appears to be outside the Jaipur district boundary. The pin has been kept inside Jaipur.");
          return;
        }

        if (mapRef.current && markerRef.current) {
          markerRef.current.setLngLat([longitude, latitude]);
          mapRef.current.easeTo({ center: [longitude, latitude], zoom: 16, duration: 600 });
        }
        updatePosition(latitude, longitude, Math.round(accuracy));
      },
      (err) => {
        setLocating(false);
        alert(`Could not fetch GPS location: ${err.message}. Using default Jaipur coordinates.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="location-picker-card">
      <div className="picker-header">
        <div className="picker-title">
          <MapPin size={18} className="text-red" />
          <span>Pinpoint Exact Location (Jaipur Only)</span>
        </div>
        <button
          type="button"
          className="locate-me-btn"
          onClick={handleUseCurrentLocation}
          disabled={locating}
        >
          {locating ? <Loader2 size={15} className="spin" /> : <Navigation size={15} />}
          <span>{locating ? "Acquiring GPS..." : "Use My GPS Location"}</span>
        </button>
      </div>

      <div className="picker-map-wrapper">
        <div ref={nodeRef} className="picker-map-canvas" />

        {/* Top-Left Geographic Boundary Indicator */}
        <div className="picker-map-hint">
          <span>Locked to Jaipur · Click or drag pin</span>
        </div>

        {/* Top-Right Map Mode Controls: Satellite & 3D */}
        <div className="picker-map-controls">
          <button
            type="button"
            className={`picker-ctrl-btn ${isSatellite ? "satellite-active" : ""}`}
            onClick={toggleSatellite}
            title={isSatellite ? "Switch to street map" : "Switch to high-res satellite imagery"}
          >
            <Satellite size={13} />
            <span>{isSatellite ? "Satellite" : "Street"}</span>
          </button>

          <button
            type="button"
            className={`picker-ctrl-btn ${is3D ? "active" : ""}`}
            onClick={togglePitch}
            title={is3D ? "Switch to flat 2D view" : "Switch to 3D perspective view"}
          >
            <Layers size={13} />
            <span>{is3D ? "3D On" : "2D"}</span>
          </button>
        </div>
      </div>

      <div className="picker-footer">
        <div className="coords-readout">
          <span className="coord-chip">Lat: {Number(currentLat).toFixed(4)}</span>
          <span className="coord-chip">Lng: {Number(currentLng).toFixed(4)}</span>
          {gpsAccuracyMeters ? (
            <span className="coord-chip accuracy">±{gpsAccuracyMeters}m</span>
          ) : null}
        </div>

        <div className="ward-detector-status">
          {detectingWard ? (
            <div className="ward-chip detecting">
              <Loader2 size={14} className="spin" />
              <span>Detecting Jaipur ward...</span>
            </div>
          ) : detectedWard ? (
            <div className="ward-chip matched">
              <CheckCircle2 size={14} />
              <span>
                Ward {detectedWard.wardNumber}: <strong>{detectedWard.wardName}</strong> ({detectedWard.zone} Zone)
              </span>
            </div>
          ) : detectError ? (
            <div className="ward-chip unmatched">
              <HelpCircle size={14} />
              <span>{detectError}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
