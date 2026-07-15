const DEFAULT_SIATUBE_API_ORIGIN = "https://siatube.com";

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_SIATUBE_API_ORIGIN;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SIATUBE_API_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_SIATUBE_API_ORIGIN;
  }
}

// Use the current origin by default so Vite/Express can proxy `/api` to
// siatube.com. The deployed API only grants CORS to siatube.com itself, so a
// direct cross-origin default would fail on preview and self-hosted domains.
const configuredOrigin = import.meta.env?.VITE_SIATUBE_API_ORIGIN ||
  (typeof window !== "undefined" ? window.location.origin : undefined);

export const SIATUBE_API_ORIGIN = normalizeOrigin(configuredOrigin);
export { DEFAULT_SIATUBE_API_ORIGIN };

// Legacy exports are intentionally kept while callers migrate from the old
// randomly selected Apps Script endpoints. They now always resolve to SiaTube.
export const API_URLS = Object.freeze([SIATUBE_API_ORIGIN]);

export function apiurl() {
  return SIATUBE_API_ORIGIN;
}

export const STORAGE_KEY = "custom_api_endpoints_v1";
export const MODE_KEY = "api_mode_v1";
