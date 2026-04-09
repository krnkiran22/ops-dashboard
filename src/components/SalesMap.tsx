"use client";

/**
 * SSR-safe wrapper for the sales Leaflet map.
 *
 * Dynamic import with ssr:false because Leaflet accesses browser globals.
 * The inner component renders factory pins, handles placement mode for
 * new referrals, and emits callbacks for pin selection.
 */

import dynamic from "next/dynamic";

export interface FactoryPin {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  headcount: number;
  payout: number;
  status: string;
  contactName: string;
  contactPhone: string;
  days: number;
}

export interface PlacedPin {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  placeId?: string;
  googleMapsUrl?: string;
}

interface SalesMapProps {
  factories: FactoryPin[];
  onSelectFactory: (factory: FactoryPin) => void;
  onStatusChange?: (factoryId: string, newStatus: string) => void;
  referMode: boolean;
  onPlacePin: (pin: PlacedPin) => void;
  theme?: string;
  className?: string;
}

const SalesMapInner = dynamic(
  () => import("./SalesMapInner") as Promise<{ default: React.ComponentType<SalesMapProps> }>,
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted/30 animate-pulse-subtle flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);

export function SalesMap(props: SalesMapProps) {
  return <SalesMapInner {...props} />;
}
