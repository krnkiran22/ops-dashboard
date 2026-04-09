"use client";

/**
 * SSR-safe wrapper for the Leaflet-based address picker.
 *
 * Uses next/dynamic with ssr:false because Leaflet requires browser
 * DOM globals. Parent forms import this component instead of the
 * inner one directly.
 */

import dynamic from "next/dynamic";
import type { AddressMapPickerValue } from "./AddressMapPickerInner";

const AddressMapPickerInner = dynamic(
  () => import("./AddressMapPickerInner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[250px] border border-border flex items-center justify-center text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  }
);

export type { AddressMapPickerValue };

interface AddressMapPickerProps {
  value?: AddressMapPickerValue | null;
  onChange: (value: AddressMapPickerValue) => void;
  theme?: string;
}

/**
 * Reusable map-backed address input with Nominatim geocoding.
 *
 * Renders a search input + Leaflet map with CartoDB tiles.
 * On address selection, the map flies to the pin and returns
 * lat, lng, formatted address, and city to the parent form.
 */
export function AddressMapPicker({
  value,
  onChange,
  theme,
}: AddressMapPickerProps) {
  return (
    <AddressMapPickerInner value={value} onChange={onChange} theme={theme} />
  );
}
