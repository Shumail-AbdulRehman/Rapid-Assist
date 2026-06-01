import * as Location from "expo-location";
import { GEOAPIFY_API_KEY } from "./config";

function buildAddressLabel(parts) {
  return parts.filter(Boolean).join(", ");
}

export async function getCurrentDeviceLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Location permission is required");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));

  let address = "";

  try {
    const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = reverse[0];

    if (first) {
      address = buildAddressLabel([
        first.name,
        first.street,
        first.city || first.subregion,
        first.region,
      ]);
    }
  } catch (_error) {
    address = "";
  }

  return {
    latitude,
    longitude,
    address,
  };
}

export async function searchAddress(text, nearLocation = null) {
  const query = text?.trim();

  if (!query) {
    return [];
  }

  if (GEOAPIFY_API_KEY) {
    const params = new URLSearchParams({
      text: query,
      format: "json",
      filter: "countrycode:pk",
      limit: "5",
      apiKey: GEOAPIFY_API_KEY,
    });

    if (nearLocation?.latitude != null && nearLocation?.longitude != null) {
      params.set("bias", `proximity:${nearLocation.longitude},${nearLocation.latitude}`);
    }

    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);
    const data = await readJsonResponse(response);

    return (data.results || []).map((result) => ({
      label:
        result.formatted ||
        buildAddressLabel([result.address_line1, result.address_line2, result.city, result.state]),
      latitude: result.lat,
      longitude: result.lon,
    }));
  }

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "pk",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RapidAssist/1.0",
    },
  });
  const data = await readJsonResponse(response);

  return (Array.isArray(data) ? data : []).map((result) => ({
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  }));
}

async function readJsonResponse(response) {
  const body = await response.text();

  if (!response.ok) {
    throw new Error("Address search is unavailable right now. Enter the address manually.");
  }

  try {
    return body ? JSON.parse(body) : null;
  } catch (_error) {
    throw new Error("Address search returned an unreadable response. Enter the address manually.");
  }
}
