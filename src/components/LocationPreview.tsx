"use client";

/**
 * Read-only Leaflet map that shows a single pin at a given coordinate.
 *
 * Used inside detail modals for factories and assignments to give
 * geographic context without the full search/picker functionality.
 * Must be loaded via next/dynamic with ssr: false (Leaflet needs DOM).
 */

import dynamic from "next/dynamic";

const LocationPreviewInner = dynamic(
  () => import("./LocationPreviewInner") as Promise<{ default: React.ComponentType<{ lat: number; lng: number; label?: string; theme?: string; className?: string }> }>,
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted/30 animate-pulse-subtle" />
    ),
  }
);

export function LocationPreview({
  lat,
  lng,
  label,
  theme,
  className,
}: {
  lat: number;
  lng: number;
  label?: string;
  theme?: string;
  className?: string;
}) {
  return (
    <LocationPreviewInner
      lat={lat}
      lng={lng}
      label={label}
      theme={theme}
      className={className}
    />
  );
}
