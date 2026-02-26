const API_URLS = ["/exec"];

// ランダムに1つ返す関数
export function apiurl() {
  const index = Math.floor(Math.random() * API_URLS.length);
  return API_URLS[index];
}

export { API_URLS };

export const STORAGE_KEY = "custom_api_endpoints_v1";
export const MODE_KEY = "api_mode_v1";
