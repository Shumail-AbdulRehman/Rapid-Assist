import Constants from "expo-constants";

function resolveApiUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:4000/api`;
  }

  const configUrl = Constants.expoConfig?.extra?.apiUrl?.trim();

  if (configUrl) {
    return configUrl.replace(/\/$/, "");
  }

  return "http://localhost:4000/api";
}

export const API_URL = resolveApiUrl();
export const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY?.trim() || "";
