import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";

export function RequestMap({ userLocation, providerLocation, nearbyRequests = [], nearbyProviders = [] }) {
  const center = providerLocation || userLocation || [24.8607, 67.0011];

  return (
    <div className="leaflet-card">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation ? (
          <CircleMarker center={userLocation} radius={12} pathOptions={{ color: "#ffb84d", fillColor: "#ffb84d" }}>
            <Popup>User request location</Popup>
          </CircleMarker>
        ) : null}

        {providerLocation ? (
          <CircleMarker
            center={providerLocation}
            radius={12}
            pathOptions={{ color: "#46d0a4", fillColor: "#46d0a4" }}
          >
            <Popup>Provider live location</Popup>
          </CircleMarker>
        ) : null}

        {userLocation && providerLocation ? (
          <Polyline positions={[userLocation, providerLocation]} pathOptions={{ color: "#f6f4eb", weight: 4 }} />
        ) : null}

        {nearbyRequests.map((request) => (
          <CircleMarker
            key={request.id}
            center={[request.latitude, request.longitude]}
            radius={10}
            pathOptions={{ color: "#ffffff", fillColor: "#8bd3ff" }}
          >
            <Popup>
              {request.serviceName} | {request.distanceKm} km
            </Popup>
          </CircleMarker>
        ))}

        {nearbyProviders.map((provider) => (
          <CircleMarker
            key={provider.id}
            center={[provider.latitude, provider.longitude]}
            radius={10}
            pathOptions={{ color: "#46d0a4", fillColor: "#46d0a4" }}
          >
            <Popup>
              {provider.name} | {provider.distanceKm} km
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
