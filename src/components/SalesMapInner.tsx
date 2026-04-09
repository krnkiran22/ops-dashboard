"use client";

/**
 * Full-screen Leaflet map for the sales portal.
 *
 * Pins show a compact label (name + value). Hovering expands to full
 * card with status selector. This prevents overlap when factories are
 * close together. Status changes emit onStatusChange.
 */

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FactoryPin, PlacedPin } from "./SalesMap";

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const INDIA_CENTER: L.LatLngTuple = [20.5, 78.9];

const STATUS: Record<string, { fill: string; border: string; label: string }> = {
  lead:               { fill: "#a1a1aa", border: "#71717a", label: "Submitted" },
  confirmed:          { fill: "#facc15", border: "#ca8a04", label: "Confirmed" },
  accepted:           { fill: "#60a5fa", border: "#2563eb", label: "Accepted" },
  deferred:           { fill: "#fb923c", border: "#ea580c", label: "On Hold" },
  rejected:           { fill: "#f87171", border: "#dc2626", label: "Not Selected" },
  cancelled:          { fill: "#a1a1aa", border: "#71717a", label: "Cancelled" },
  pending_visit:      { fill: "#c084fc", border: "#9333ea", label: "In Progress" },
  pending_allocation: { fill: "#c084fc", border: "#9333ea", label: "In Progress" },
  pending_shipment:   { fill: "#c084fc", border: "#9333ea", label: "In Progress" },
  pending_deployment: { fill: "#c084fc", border: "#9333ea", label: "In Progress" },
  deployed:           { fill: "#34d399", border: "#059669", label: "Active" },
};

/** Card — always visible next to pin */
function cardHtml(f: FactoryPin): string {
  const s = STATUS[f.status] || STATUS.lead;
  return `<div class="fcard" data-fid="${f.id}">
  <div class="fcard-head"><span class="fcard-name">${f.name}</span><span class="fcard-badge" style="background:${s.fill}20;color:${s.fill}">${s.label}</span></div>
  <div class="fcard-sub">${f.city} · ${f.headcount.toLocaleString("en-US")} workers</div>
  <div class="fcard-val">$${f.payout.toLocaleString("en-US")}</div>
</div>`;
}

/** Expanded popup — salesperson can only mark 'confirmed' on new leads. */
function popupHtml(f: FactoryPin): string {
  const s = STATUS[f.status] || STATUS.lead;
  const confirmBtn = f.status === "lead"
    ? `<div class="fpopup-statuses"><button class="fstatus-btn" data-fid="${f.id}" data-status="confirmed" style="background:${STATUS.confirmed.fill}20;color:${STATUS.confirmed.fill};border-color:${STATUS.confirmed.fill}40">Mark Owner Confirmed</button></div>`
    : `<div class="fpopup-statuses"><span class="fstatus-btn active" style="background:${s.fill}20;color:${s.fill};border-color:${s.fill}40">${s.label}</span></div>`;

  return `<div class="fpopup">
  <div class="fpopup-name">${f.name}</div>
  <div class="fpopup-meta">${f.city} · ${f.headcount.toLocaleString("en-US")} workers · $${f.payout.toLocaleString("en-US")}</div>
  ${f.contactName ? `<div class="fpopup-contact">${f.contactName}${f.contactPhone ? ` · ${f.contactPhone}` : ""}</div>` : ""}
  ${confirmBtn}
</div>`;
}

interface Props {
  factories: FactoryPin[];
  onSelectFactory: (factory: FactoryPin) => void;
  onStatusChange?: (factoryId: string, newStatus: string) => void;
  referMode: boolean;
  onPlacePin: (pin: PlacedPin) => void;
  theme?: string;
  className?: string;
}

export default function SalesMapInner({
  factories,
  onStatusChange,
  referMode,
  onPlacePin,
  theme = "light",
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const placedLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const referModeRef = useRef(referMode);
  const onPlaceRef = useRef(onPlacePin);
  const onStatusRef = useRef(onStatusChange);
  const factoriesRef = useRef(factories);

  referModeRef.current = referMode;
  onPlaceRef.current = onPlacePin;
  onStatusRef.current = onStatusChange;
  factoriesRef.current = factories;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
      maxBounds: L.latLngBounds([6, 65], [38, 100]),
      minZoom: 4,
    });

    tileRef.current = L.tileLayer(theme === "dark" ? DARK_TILES : LIGHT_TILES, { attribution: ATTR, maxZoom: 18 }).addTo(map);
    markerLayerRef.current.addTo(map);
    placedLayerRef.current.addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    // Status button click delegation
    map.on("popupopen", () => {
      const btns = containerRef.current?.querySelectorAll(".fstatus-btn");
      btns?.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const el = e.currentTarget as HTMLElement;
          const fid = el.getAttribute("data-fid");
          const status = el.getAttribute("data-status");
          if (fid && status && onStatusRef.current) onStatusRef.current(fid, status);
        });
      });
    });

    // Refer mode click
    map.on("click", async (e: L.LeafletMouseEvent) => {
      if (!referModeRef.current) return;
      const { lat, lng } = e.latlng;
      placedLayerRef.current.clearLayers();

      L.circleMarker([lat, lng], {
        radius: 18, fillColor: "#3b82f6", fillOpacity: 0.12,
        color: "#3b82f6", weight: 1, opacity: 0.3,
      }).addTo(placedLayerRef.current);
      L.circleMarker([lat, lng], {
        radius: 8, fillColor: "#3b82f6", fillOpacity: 0.9,
        color: "#2563eb", weight: 2,
      }).addTo(placedLayerRef.current);

      let address = "";
      let city = "";
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          { headers: { "User-Agent": "BuildAI-Ops/1.0" } }
        );
        const data = await res.json();
        address = data.display_name || "";
        city = data.address?.city || data.address?.town || data.address?.village || data.address?.state_district || "";
      } catch { /* still place */ }

      onPlaceRef.current({ lat, lng, address, city });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; tileRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tileRef.current) return;
    tileRef.current.setUrl(theme === "dark" ? DARK_TILES : LIGHT_TILES);
  }, [theme]);

  const renderPins = useCallback(() => {
    const layer = markerLayerRef.current;
    layer.clearLayers();

    factories.forEach((f) => {
      if (!f.lat || !f.lng) return;
      const s = STATUS[f.status] || STATUS.lead;

      // Glow
      L.circleMarker([f.lat, f.lng], {
        radius: 12, fillColor: s.fill, fillOpacity: 0.15,
        color: s.fill, weight: 1, opacity: 0.2,
      }).addTo(layer);

      // Pin
      const marker = L.circleMarker([f.lat, f.lng], {
        radius: 6, fillColor: s.fill, fillOpacity: 0.85,
        color: s.border, weight: 1.5,
      }).addTo(layer);

      // Permanent card tooltip
      marker.bindTooltip(cardHtml(f), {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "fcard-tooltip",
        interactive: true,
      });

      // Full popup on click (with status selector)
      marker.bindPopup(popupHtml(f), {
        className: "fpopup-container",
        maxWidth: 280,
        minWidth: 200,
        closeButton: true,
        offset: [0, -8],
      });
    });

    const valid = factories.filter((f) => f.lat && f.lng);
    if (valid.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(valid.map((f) => [f.lat, f.lng] as L.LatLngTuple));
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
    }
  }, [factories]);

  useEffect(() => { renderPins(); }, [renderPins]);

  useEffect(() => {
    if (!referMode) placedLayerRef.current.clearLayers();
  }, [referMode]);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
