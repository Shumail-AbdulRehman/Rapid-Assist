import { View } from "react-native";
import { WebView } from "react-native-webview";

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

export function MapPreview({ requestLocation, providerLocation, nearbyRequests = [] }) {
  const center = providerLocation || requestLocation || { latitude: 24.8607, longitude: 67.0011 };
  const requestScript = requestLocation
    ? `L.circleMarker([${requestLocation.latitude}, ${requestLocation.longitude}], {radius: 10, color: '#ffb84d', fillColor: '#ffb84d', fillOpacity: 1}).addTo(map).bindPopup('Request location');`
    : "";
  const providerScript = providerLocation
    ? `L.circleMarker([${providerLocation.latitude}, ${providerLocation.longitude}], {radius: 10, color: '#46d0a4', fillColor: '#46d0a4', fillOpacity: 1}).addTo(map).bindPopup('Provider location');`
    : "";
  const lineScript =
    requestLocation && providerLocation
      ? `L.polyline([[${requestLocation.latitude}, ${requestLocation.longitude}], [${providerLocation.latitude}, ${providerLocation.longitude}]], {color: '#f7f7ef', weight: 4}).addTo(map);`
      : "";
  const nearbyScript = nearbyRequests
    .map(
      (request) =>
        `L.circleMarker([${request.latitude}, ${request.longitude}], {radius: 8, color: '#8bd3ff', fillColor: '#8bd3ff', fillOpacity: 1}).addTo(map).bindPopup('${escapeText(request.serviceName)} - ${request.distanceKm} km');`
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
          html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f2027; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map').setView([${center.latitude}, ${center.longitude}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);
          ${requestScript}
          ${providerScript}
          ${lineScript}
          ${nearbyScript}
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ height: 260, borderRadius: 18, overflow: "hidden", marginBottom: 12 }}>
      <WebView originWhitelist={["*"]} source={{ html }} />
    </View>
  );
}
