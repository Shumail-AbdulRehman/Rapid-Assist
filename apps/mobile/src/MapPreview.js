import { View } from "react-native";
import { WebView } from "react-native-webview";
import { GEOAPIFY_API_KEY } from "./config";

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

export function MapPreview({
  requestLocation,
  destinationLocation,
  providerLocation,
  nearbyRequests = [],
}) {
  const center =
    providerLocation || requestLocation || destinationLocation || { latitude: 24.8607, longitude: 67.0011 };
  const tileUrl = GEOAPIFY_API_KEY
    ? `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = GEOAPIFY_API_KEY
    ? '&copy; OpenStreetMap contributors, Powered by Geoapify'
    : '&copy; OpenStreetMap contributors';
  const requestScript = requestLocation
    ? `L.circleMarker([${requestLocation.latitude}, ${requestLocation.longitude}], {radius: 10, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 1}).addTo(map).bindPopup('Pickup');`
    : "";
  const providerScript = providerLocation
    ? `L.circleMarker([${providerLocation.latitude}, ${providerLocation.longitude}], {radius: 10, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1}).addTo(map).bindPopup('Provider');`
    : "";
  const destinationScript = destinationLocation
    ? `L.circleMarker([${destinationLocation.latitude}, ${destinationLocation.longitude}], {radius: 10, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1}).addTo(map).bindPopup('Destination');`
    : "";
  const lineScript =
    requestLocation && destinationLocation
      ? `L.polyline([[${requestLocation.latitude}, ${requestLocation.longitude}], [${destinationLocation.latitude}, ${destinationLocation.longitude}]], {color: '#7c3aed', weight: 4, opacity: 0.75}).addTo(map);`
      : requestLocation && providerLocation
        ? `L.polyline([[${requestLocation.latitude}, ${requestLocation.longitude}], [${providerLocation.latitude}, ${providerLocation.longitude}]], {color: '#7c3aed', weight: 4, opacity: 0.75}).addTo(map);`
        : "";
  const providerTrailScript =
    requestLocation && providerLocation && destinationLocation
      ? `L.polyline([[${providerLocation.latitude}, ${providerLocation.longitude}], [${requestLocation.latitude}, ${requestLocation.longitude}]], {color: '#22c55e', weight: 3, opacity: 0.55, dashArray: '6 8'}).addTo(map);`
      : "";
  const fitBoundsScript = [requestLocation, destinationLocation, providerLocation]
    .filter(Boolean)
    .map((point) => `[${point.latitude}, ${point.longitude}]`)
    .join(",");
  const nearbyScript = nearbyRequests
    .map(
      (request) =>
        `L.circleMarker([${request.latitude}, ${request.longitude}], {radius: 8, color: '#c4b5fd', fillColor: '#c4b5fd', fillOpacity: 1}).addTo(map).bindPopup('${escapeText(request.markerLabel || request.serviceName || "Nearby provider")} - ${request.distanceKm} km');`
    )
    .join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <style>
          html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f7f4ff; }
          .leaflet-control-attribution {
            background: rgba(255, 255, 255, 0.82) !important;
            color: #6b5d8d !important;
            font-family: sans-serif !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map').setView([${center.latitude}, ${center.longitude}], 13);
          L.tileLayer('${tileUrl}', {
            attribution: '${attribution}'
          }).addTo(map);
          ${requestScript}
          ${providerScript}
          ${destinationScript}
          ${lineScript}
          ${providerTrailScript}
          ${nearbyScript}
          ${fitBoundsScript ? `map.fitBounds([${fitBoundsScript}], {padding: [28, 28]});` : ""}
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ height: 228, borderRadius: 24, overflow: "hidden", marginBottom: 12 }}>
      <WebView originWhitelist={["*"]} source={{ html }} />
    </View>
  );
}
