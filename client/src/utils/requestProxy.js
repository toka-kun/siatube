const URL_KEY = "requestProxyUrl";
const HEALTHCHECK_URL = "https://siatube.com/";

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`requestProxy: failed to save ${key}`, error);
  }
}

export function loadRequestProxy() {
  return {
    url: String(read(URL_KEY, "") || "").trim(),
  };
}

export function saveRequestProxy(url) {
  const normalized = normalizeRequestProxyUrl(url);
  write(URL_KEY, normalized);
  return normalized;
}

export function normalizeRequestProxyUrl(value) {
  const proxyUrl = String(value || "").trim();
  if (!proxyUrl) return "";

  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new TypeError("Proxy URL must be a valid HTTP(S) URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TypeError("Proxy URL must be a valid HTTP(S) URL");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError("Proxy URL must not contain credentials");
  }
  if (parsed.search || parsed.hash) {
    throw new TypeError("Proxy URL must not contain a query string or fragment");
  }

  // Accept a harmless trailing delimiter without producing `??url=`/`#?url=`.
  return proxyUrl.replace(/[?#]+$/, "");
}

/**
 * Convert an HTTP(S) request URL to `<proxy URL>?url=<encoded request URL>`.
 * Relative and non-network request URLs are deliberately left untouched.
 * An invalid configured proxy throws so a direct request is never made by mistake.
 */
export function proxiedRequestUrl(requestUrl, settings = loadRequestProxy()) {
  const original = typeof requestUrl === "string" ? requestUrl : requestUrl?.toString?.();
  if (!original) return original;

  const proxyValue = typeof settings === "string" ? settings : settings?.url;
  if (!String(proxyValue || "").trim()) return original;

  try {
    const target = new URL(original);
    if (!["http:", "https:"].includes(target.protocol)) return original;
  } catch {
    return original;
  }

  const proxyUrl = normalizeRequestProxyUrl(proxyValue);
  return `${proxyUrl}?url=${encodeURIComponent(original)}`;
}

export async function checkRequestProxy(
  proxyUrl,
  { fetchImpl = globalThis.fetch, signal } = {},
) {
  const normalizedProxyUrl = normalizeRequestProxyUrl(proxyUrl);
  if (!normalizedProxyUrl) {
    throw new TypeError("Proxy URL is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is not available");
  }

  const response = await fetchImpl(
    proxiedRequestUrl(HEALTHCHECK_URL, { url: normalizedProxyUrl }),
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      redirect: "follow",
      signal,
    },
  );

  if (!response?.ok) {
    throw new Error(`Proxy check failed with HTTP ${response?.status ?? "unknown"}`);
  }

  try {
    const payload = await response.json();
    if (
      payload === null ||
      typeof payload !== "object" ||
      typeof payload.status !== "string" ||
      !payload.status.trim() ||
      payload.error
    ) {
      throw new TypeError("Proxy check JSON must contain a valid status");
    }
    return payload;
  } catch (cause) {
    const error = new Error("Proxy check returned invalid JSON");
    error.cause = cause;
    throw error;
  }
}

export {
  HEALTHCHECK_URL as REQUEST_PROXY_HEALTHCHECK_URL,
  URL_KEY as REQUEST_PROXY_URL_KEY,
};
