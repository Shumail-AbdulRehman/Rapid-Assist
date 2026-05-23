import Constants from "expo-constants";

function resolveApiUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const configUrl = Constants.expoConfig?.extra?.apiUrl?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  if (configUrl) {
    return configUrl.replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:4000/api`;
  }

  return "http://192.168.1.22:4000/api";
}

export const API_URL = resolveApiUrl();
