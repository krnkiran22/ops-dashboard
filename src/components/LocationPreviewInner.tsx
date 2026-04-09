"use client";

/**
 * Inner read-only Leaflet map — renders a single marker at the given
 * coordinate with an optional tooltip label. No search, no interaction
 * beyond pan/zoom. Tiles match the dashboard's CartoDB provider.
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export default function LocationPreviewInner({
  lat,
  lng,
  label,
  theme = "light",
  className,
}: {
  lat: number;
  lng: number;
  label?: string;
  theme?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      attributionControl: false,
    });

    const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
    L.tileLayer(tileUrl, { attribution: ATTRIBUTION }).addTo(map);

    // Circle marker matching dashboard style
    L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#34d399",
      fillOpacity: 0.9,
      color: "#34d399",
      weight: 2,
      opacity: 0.4,
    }).addTo(map);

    // Glow ring
    L.circleMarker([lat, lng], {
      radius: 16,
      fillColor: "#34d399",
      fillOpacity: 0.1,
      color: "#34d399",
      weight: 1,
      opacity: 0.2,
    }).addTo(map);

    if (label) {
      L.tooltip({ permanent: true, direction: "top", offset: [0, -20] })
        .setLatLng([lat, lng])
        .setContent(`<span style="font-weight:600;font-size:11px">${label}</span>`)
        .addTo(map);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
