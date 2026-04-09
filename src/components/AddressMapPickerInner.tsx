"use client";

/**
 * Inner Leaflet map component with Google Places Autocomplete.
 *
 * Must be loaded via next/dynamic with ssr: false because Leaflet
 * accesses browser DOM APIs (window, document) at import time.
 * Uses CartoDB tiles for the map preview and Google Places for
 * address search with structured component extraction.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const INDIA_CENTER: L.LatLngTuple = [20.5, 78.9];
const INDIA_ZOOM = 5;

export interface AddressMapPickerValue {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  placeId?: string;
  googleMapsUrl?: string;
}

interface AddressMapPickerInnerProps {
  value?: AddressMapPickerValue | null;
  onChange: (value: AddressMapPickerValue) => void;
  theme?: string;
}

/**
 * Extract a specific address component type from Google's structured result.
 * Returns short_name by default, or long_name if specified.
 */
function extractComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  long = false,
): string {
  const match = components.find((c) => c.types.includes(type));
  return match ? (long ? match.long_name : match.short_name) : "";
}

export default function AddressMapPickerInner({
  value,
  onChange,
  theme = "dark",
}: AddressMapPickerInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const attrDivRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isLoaded } = useGoogleMaps();

  // Initialize Google services once loaded
  useEffect(() => {
    if (!isLoaded) return;
    autocompleteRef.current = new google.maps.places.AutocompleteService();
    // PlacesService needs an HTML element for attributions
    if (!attrDivRef.current) {
      attrDivRef.current = document.createElement("div");
    }
    placesRef.current = new google.maps.places.PlacesService(attrDivRef.current);
  }, [isLoaded]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : INDIA_CENTER,
      zoom: value ? 14 : INDIA_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
    const tile = L.tileLayer(tileUrl, { attribution: ATTRIBUTION }).addTo(map);

    mapRef.current = map;
    tileRef.current = tile;

    if (value) {
      markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tiles when theme changes
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
    tileRef.current.setUrl(tileUrl);
  }, [theme]);

  const searchPlaces = useCallback(
    (input: string) => {
      if (input.length < 3 || !autocompleteRef.current) {
        setPredictions([]);
        return;
      }
      setSearching(true);
      autocompleteRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "in" },
          types: ["establishment", "geocode"],
        },
        (results, status) => {
          setSearching(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            results
          ) {
            setPredictions(results);
            setShowResults(true);
          } else {
            setPredictions([]);
          }
        },
      );
    },
    [],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 300);
  };

  const handleSelect = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      if (!placesRef.current) return;

      setQuery(prediction.description);
      setShowResults(false);
      setPredictions([]);

      placesRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["geometry", "address_components", "formatted_address", "place_id"],
        },
        (place, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place?.geometry?.location
          ) {
            return;
          }

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const components = place.address_components ?? [];

          // Extract structured address data
          const city =
            extractComponent(components, "locality", true) ||
            extractComponent(components, "administrative_area_level_2", true) ||
            extractComponent(components, "sublocality_level_1", true);
          const state = extractComponent(components, "administrative_area_level_1", true);
          const postalCode = extractComponent(components, "postal_code");
          const placeId = place.place_id ?? prediction.place_id;

          // Fly map to location
          if (mapRef.current) {
            mapRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
          }

          // Update or create marker
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else if (mapRef.current) {
            markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
          }

          setQuery(place.formatted_address ?? prediction.description);

          onChange({
            lat,
            lng,
            address: place.formatted_address ?? prediction.description,
            city,
            state,
            postalCode,
            placeId,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          });
        },
      );
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={isLoaded ? "Search factory address..." : "Loading maps..."}
          disabled={!isLoaded}
          className="w-full h-12 border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 placeholder:text-muted-foreground disabled:opacity-50"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            searching...
          </span>
        )}

        {/* Dropdown results */}
        {showResults && predictions.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 top-full mt-1 border border-border bg-card max-h-48 overflow-y-auto shadow-lg">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(p);
                }}
              >
                <div className="font-medium text-[13px]">
                  {p.structured_formatting.main_text}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.structured_formatting.secondary_text}
                </div>
              </button>
            ))}
            <div className="px-4 py-1.5 text-[9px] text-muted-foreground text-right">
              Powered by Google
            </div>
          </div>
        )}
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full h-[250px] border border-border"
        style={{ zIndex: 0 }}
      />
    </div>
  );
}
