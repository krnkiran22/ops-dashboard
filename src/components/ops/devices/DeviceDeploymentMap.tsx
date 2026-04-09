"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";
import type { TransitRow } from "@/components/ops/shipments/InTransitTable";

export interface DeploymentPin {
  id?: string;
  city: string;
  latitude: number;
  longitude: number;
  status: string;
  quantity: number;
  pocName: string;
}

const STATUS_COLORS: Record<string, { fill: string; border: string; label: string }> = {
  deployed: { fill: "#34d399", border: "#059669", label: "Active" },
  idle: { fill: "#f87171", border: "#dc2626", label: "Idle" },
  lead: { fill: "#fbbf24", border: "#d97706", label: "Lead" },
  new: { fill: "#fbbf24", border: "#d97706", label: "New" },
  allocating: { fill: "#60a5fa", border: "#3b82f6", label: "Pending Allocation" },
  shipping: { fill: "#a78bfa", border: "#7c3aed", label: "Pending Shipment" },
  deploying: { fill: "#34d399", border: "#059669", label: "Deploying" },
  source: { fill: "#60a5fa", border: "#3b82f6", label: "Hub" },
  target: { fill: "#f97316", border: "#ea580c", label: "Target" },
};

const FALLBACK_COLOR = { fill: "#94a3b8", border: "#64748b", label: "Unknown" };

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTR = '&copy; <a href="https://osm.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const CITY_COORDS: Record<string, L.LatLngTuple> = {
  Delhi: [28.6139, 77.209], Mumbai: [19.076, 72.8777], Bengaluru: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707], Hyderabad: [17.385, 78.4867], Kolkata: [22.5726, 88.3639],
  Shenzhen: [22.5431, 114.0579], Pune: [18.5204, 73.8567],
  Surat: [21.1702, 72.8311], Jaipur: [26.9124, 75.7873],
  Ahmedabad: [23.0225, 72.5714], Coimbatore: [11.0168, 76.9558],
  Tirupur: [11.1085, 77.3411], Indore: [22.7196, 75.8577],
  Lucknow: [26.8467, 80.9462],
};

interface Props {
  pins?: DeploymentPin[];
  transitLines?: TransitRow[];
  highlightId?: string | null;
  onPinClick?: (pin: DeploymentPin) => void;
  /** Allocation mode: called when user confirms allocation from a source hub. */
  onAllocateConfirm?: (sourceCity: string, quantity: number) => void;
}

export function DeviceDeploymentMap({
  pins = [],
  transitLines = [],
  highlightId,
  onPinClick,
  onAllocateConfirm,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());
  const highlightLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const { resolvedTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const onAllocRef = useRef(onAllocateConfirm);
  onAllocRef.current = onAllocateConfirm;

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    });
    mapRef.current = map;
    const dark = resolvedTheme === "dark";
    tileRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, { attribution: ATTR, maxZoom: 18 }).addTo(map);
    layerRef.current.addTo(map);
    highlightLayerRef.current.addTo(map);
    map.fitBounds(L.latLngBounds([6.5, 68], [35.5, 97.5]), { padding: [10, 10] });
    map.setMaxBounds(L.latLngBounds([0, 55], [40, 120]));
    map.setMinZoom(4);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme swap
  useEffect(() => {
    if (!tileRef.current) return;
    tileRef.current.setUrl(resolvedTheme === "dark" ? DARK_TILES : LIGHT_TILES);
  }, [resolvedTheme]);

  // Draw everything
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    layer.clearLayers();

    const targetPin = pins.find((p) => p.status === "target");
    const isAllocMode = Boolean(targetPin);
    const sources = isAllocMode ? pins.filter((p) => p.status === "source") : [];

    // ── Allocation mode: draw arrow lines from every source → target ──
    if (isAllocMode && targetPin) {
      for (const src of sources) {
        // Glow line
        L.polyline(
          [[src.latitude, src.longitude], [targetPin.latitude, targetPin.longitude]],
          { color: "#60a5fa", weight: 3, opacity: 0.08 },
        ).addTo(layer);

        // Dashed line
        L.polyline(
          [[src.latitude, src.longitude], [targetPin.latitude, targetPin.longitude]],
          { color: "#60a5fa", weight: 1.5, opacity: 0.4, dashArray: "6 10", className: "transit-flow" },
        ).addTo(layer);

        // Arrow at midpoint
        const mLat = (src.latitude + targetPin.latitude) / 2;
        const mLng = (src.longitude + targetPin.longitude) / 2;
        const dLat = targetPin.latitude - src.latitude;
        const dLng = targetPin.longitude - src.longitude;
        const bearing = Math.atan2(dLng, dLat) * (180 / Math.PI);
        const cssAngle = bearing - 90;
        L.marker([mLat, mLng], {
          interactive: false,
          icon: L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 12 12" style="transform:rotate(${cssAngle}deg)"><path d="M3 2L9 6L3 10" fill="#60a5fa" opacity="0.6" stroke="none"/></svg>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          }),
        }).addTo(layer);
      }
    }

    // ── Transit lines (pipeline mode) ──
    if (!isAllocMode) {
      for (const t of transitLines) {
        const parts = t.route.split("→").map((p) => p.trim());
        if (parts.length < 2) continue;
        const from = CITY_COORDS[parts[0]];
        const to = CITY_COORDS[parts[1]];
        if (!from || !to) continue;

        L.polyline([from, to], { color: "#60a5fa", weight: 4, opacity: 0.1 }).addTo(layer);
        L.polyline([from, to], {
          color: "#60a5fa", weight: 1.5, opacity: 0.6,
          dashArray: "4 12", className: "transit-flow",
        }).addTo(layer);

        const midLat = (from[0] + to[0]) / 2;
        const midLng = (from[1] + to[1]) / 2;
        const dLat = to[0] - from[0];
        const dLng = to[1] - from[1];
        const bearing = Math.atan2(dLng, dLat) * (180 / Math.PI);
        const cssAngle = bearing - 90;
        L.marker([midLat, midLng], {
          interactive: false,
          icon: L.divIcon({
            html: `<svg width="12" height="12" viewBox="0 0 12 12" style="transform:rotate(${cssAngle}deg)"><path d="M3 2L9 6L3 10" fill="#60a5fa" stroke="none"/></svg>`,
            className: "", iconSize: [12, 12], iconAnchor: [6, 6],
          }),
        }).addTo(layer);
      }
    }

    // ── Markers ──
    for (const pin of pins) {
      const c = STATUS_COLORS[pin.status] ?? FALLBACK_COLOR;
      const isHighlighted = Boolean(highlightId && pin.id === highlightId);
      const dimmed = Boolean(highlightId && pin.id !== highlightId);
      const isSource = pin.status === "source";
      const isTarget = pin.status === "target";

      // Size: all pins large enough to show count label
      const r = isTarget ? 12 : isSource ? 10 : Math.max(8, Math.min(16, 8 + pin.quantity * 0.02));

      // Glow
      L.circleMarker([pin.latitude, pin.longitude], {
        radius: r + (isSource ? 8 : 5),
        fillColor: c.fill, color: "transparent", weight: 0,
        fillOpacity: dimmed ? 0.05 : isSource ? 0.25 : 0.2,
      }).addTo(layer);

      // Highlight ring
      if (isHighlighted) {
        L.circleMarker([pin.latitude, pin.longitude], {
          radius: r + 10, fillColor: "transparent", color: c.fill,
          weight: 2, fillOpacity: 0, opacity: 0.6,
        }).addTo(layer);
      }

      // Marker
      const marker = L.circleMarker([pin.latitude, pin.longitude], {
        radius: r, fillColor: c.fill,
        color: isHighlighted ? "#fff" : isSource ? "#fff" : c.border,
        weight: isHighlighted ? 2.5 : isSource ? 2 : 1.5,
        fillOpacity: dimmed ? 0.3 : 0.85,
      }).addTo(layer);

      // Count label inside markers (all pins with quantity > 0)
      if (pin.quantity > 0) {
        L.marker([pin.latitude, pin.longitude], {
          interactive: false,
          icon: L.divIcon({
            html: `<span style="font-size:${r >= 8 ? 10 : 8}px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5)">${pin.quantity}</span>`,
            className: "flex items-center justify-center",
            iconSize: [20, 14], iconAnchor: [10, 7],
          }),
        }).addTo(layer);
      }

      // City label below markers
      {
        const labelColor = isTarget ? "#ea580c" : c.border;
        const labelBg = isTarget ? "#ea580c" : "transparent";
        const labelTextColor = isTarget ? "#fff" : labelColor;
        L.marker([pin.latitude, pin.longitude], {
          interactive: false,
          icon: L.divIcon({
            html: `<span style="font-size:9px;font-weight:600;color:${labelTextColor};background:${labelBg};padding:${isTarget ? "1px 5px" : "0"};white-space:nowrap">${isTarget ? pin.pocName : pin.pocName || pin.city}</span>`,
            className: "",
            iconSize: [140, 14],
            iconAnchor: [70, -(r + 6)],
          }),
        }).addTo(layer);
      }

      // Hover tooltip (pipeline mode only)
      if (!isAllocMode) {
        marker.bindTooltip(
          `<div style="font-family:var(--font-sans)">
            <div style="font-size:11px;font-weight:600">${pin.pocName}</div>
            <div style="font-size:10px;opacity:0.6">${pin.city}${pin.quantity ? ` · ${pin.quantity} workers` : ""}</div>
          </div>`,
          { direction: "top", offset: [0, -r - 4], className: "device-map-tooltip" },
        );
      }

      // Pipeline mode click
      if (!isAllocMode && onPinClickRef.current) {
        marker.on("click", () => onPinClickRef.current?.(pin));
      }

      // Allocation mode: source click opens a popup with qty picker
      if (isSource && map && targetPin) {
        const tp = targetPin; // closure-safe ref
        marker.on("click", () => {
          const hl = highlightLayerRef.current;
          hl.clearLayers();

          // Draw emphasized arrow from this source → target
          L.polyline(
            [[pin.latitude, pin.longitude], [tp.latitude, tp.longitude]],
            { color: "#22d3ee", weight: 3, opacity: 0.7 },
          ).addTo(hl);

          // Arrow at midpoint
          const mLat = (pin.latitude + tp.latitude) / 2;
          const mLng = (pin.longitude + tp.longitude) / 2;
          const dLat = tp.latitude - pin.latitude;
          const dLng = tp.longitude - pin.longitude;
          const bearing = Math.atan2(dLng, dLat) * (180 / Math.PI);
          const cssAngle = bearing - 90;
          L.marker([mLat, mLng], {
            interactive: false,
            icon: L.divIcon({
              html: `<svg width="16" height="16" viewBox="0 0 12 12" style="transform:rotate(${cssAngle}deg)"><path d="M2 1L10 6L2 11" fill="#22d3ee" stroke="none"/></svg>`,
              className: "", iconSize: [16, 16], iconAnchor: [8, 8],
            }),
          }).addTo(hl);

          const defaultQty = Math.min(pin.quantity, 5);

          // Build popup content as real DOM so we can attach listeners directly
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "font-family:var(--font-sans);width:140px";
          wrapper.innerHTML = `
            <div style="font-size:11px;font-weight:600;margin-bottom:1px">${pin.city} → ${tp.pocName}</div>
            <div style="font-size:10px;opacity:0.5;margin-bottom:6px">${pin.quantity} available</div>
            <div style="display:flex;align-items:center;gap:4px">
              <input data-qty type="number" min="1" max="${pin.quantity}" value="${defaultQty}"
                style="width:40px;height:22px;border:1px solid var(--border);background:var(--background);color:var(--foreground);text-align:center;font-size:11px;outline:none;border-radius:0" />
              <span style="font-size:9px;opacity:0.4">/ ${pin.quantity}</span>
              <button data-confirm
                style="flex:1;height:22px;background:var(--primary);color:var(--primary-foreground);font-size:10px;font-weight:600;border:none;cursor:pointer;border-radius:0">
                Allocate
              </button>
            </div>`;

          const confirmBtn = wrapper.querySelector("[data-confirm]") as HTMLButtonElement;
          const qtyInput = wrapper.querySelector("[data-qty]") as HTMLInputElement;

          const popup = L.popup({
            closeButton: false,
            className: "alloc-popup",
            maxWidth: 180,
            offset: [0, -r - 6],
          })
            .setLatLng([pin.latitude, pin.longitude])
            .setContent(wrapper)
            .openOn(map);

          confirmBtn.addEventListener("click", () => {
            const qty = Math.max(1, Math.min(pin.quantity, Number(qtyInput.value) || defaultQty));
            onAllocRef.current?.(pin.city, qty);
            popup.remove();
          });

          // Clear highlight arrow when popup closes
          popup.on("remove", () => hl.clearLayers());
        });
      }
    }

    // ── Zoom behavior ──
    if (highlightId && map) {
      const hl = pins.find((p) => p.id === highlightId);
      if (hl) map.flyTo([hl.latitude, hl.longitude], 8, { duration: 0.6 });
    } else if (pins.length > 0 && map) {
      const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true });
    }
  }, [pins, transitLines, highlightId]);

  function toggleExpand() {
    setExpanded((v) => !v);
    setTimeout(() => mapRef.current?.invalidateSize(), 50);
  }

  const legendEntries = [...new Set(pins.map((p) => p.status))]
    .map((s) => ({ key: s, ...(STATUS_COLORS[s] ?? FALLBACK_COLOR) }));

  return (
    <div className={`relative w-full ${expanded ? "fixed inset-0 z-[9999] bg-background" : "h-full"}`}>
      <div ref={containerRef} className="h-full w-full" />

      {legendEntries.length > 0 && (
        <div className="absolute top-2 left-2 z-[1000] flex items-center gap-2 bg-card/85 backdrop-blur-sm border border-border/50 px-2 py-1">
          {legendEntries.map((entry) => (
            <span key={entry.key} className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              <span className="size-2" style={{ backgroundColor: entry.fill }} />
              {entry.label}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={toggleExpand}
        className="absolute top-2 right-2 z-[1000] size-7 flex items-center justify-center bg-card/85 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
        title={expanded ? "Exit fullscreen" : "Fullscreen map"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          {expanded ? (
            <><path d="M5 1v3H1M9 1v3h4M5 13v-3H1M9 13v-3h4" /></>
          ) : (
            <><path d="M1 5V1h4M9 1h4v4M1 9v4h4M13 9v4H9" /></>
          )}
        </svg>
      </button>

      {pins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <p className="text-xs text-muted-foreground bg-card/80 px-4 py-2 border border-border">No deployment data</p>
        </div>
      )}
    </div>
  );
}
