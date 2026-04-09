"use client";

import { useSyncExternalStore } from "react";

const SCRIPT_ID = "google-maps-script";

/* eslint-disable @typescript-eslint/no-explicit-any */
function gmapsReady(): boolean {
  return typeof window !== "undefined" && !!(window as any).google?.maps?.places;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const listeners = new Set<() => void>();
let loaded = false;
let loading = false;

function notify() {
  loaded = true;
  for (const fn of listeners) fn();
}

function ensureScript() {
  if (loading || loaded || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return;

  if (gmapsReady()) { notify(); return; }

  loading = true;

  if (document.getElementById(SCRIPT_ID)) {
    const check = setInterval(() => {
      if (gmapsReady()) { clearInterval(check); notify(); }
    }, 50);
    return;
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = () => notify();
  document.head.appendChild(script);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  ensureScript();
  return () => { listeners.delete(cb); };
}

function getSnapshot() { return loaded || gmapsReady(); }
function getServerSnapshot() { return false; }

/**
 * Load the Google Maps JS SDK once. Returns { isLoaded } when the
 * Places library is ready to use. Uses useSyncExternalStore to
 * avoid useEffect.
 */
export function useGoogleMaps() {
  const isLoaded = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isLoaded };
}
