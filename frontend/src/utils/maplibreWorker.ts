import * as maplibregl from "maplibre-gl";

let workerUrlConfigured = false;

/**
 * Vite bundles maplibre-gl's worker as a separate module; v6 requires
 * bundler consumers to point at it explicitly (unlike CDN/ESM usage,
 * which auto-detects via import.meta.url).
 */
export function ensureMapLibreWorkerUrl(): void {
  if (workerUrlConfigured) return;
  workerUrlConfigured = true;
  maplibregl.setWorkerUrl(
    new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
  );
}
