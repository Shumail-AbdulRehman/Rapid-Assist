import { useEffect, useState } from "react";
import api from "../api";
import { RequestMap } from "./RequestMap";

export function ProviderDashboard({ session }) {
  const [location, setLocation] = useState({ latitude: "24.8615", longitude: "67.0099" });
  const [requests, setRequests] = useState([]);
  const [offerDrafts, setOfferDrafts] = useState({});
  const [message, setMessage] = useState("");

  async function loadRequests() {
    try {
      const response = await api.get("/requests/nearby", {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          radiusKm: 4,
        },
      });
      setRequests(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load nearby requests");
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateLocation() {
    try {
      await api.patch("/requests/provider/location", location);
      await loadRequests();
      setMessage("Provider location updated");
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not update location");
    }
  }

  async function sendOffer(requestId) {
    const draft = offerDrafts[requestId] || {};

    try {
      await api.post("/requests/offers", {
        requestId,
        price: Number(draft.price || 0),
        estimatedMinutes: Number(draft.estimatedMinutes || 15),
        message: draft.message || "",
      });
      setMessage("Offer sent");
      await loadRequests();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not send offer");
    }
  }

  return (
    <div className="shell dashboard-shell">
      <section className="panel wide">
        <div className="title-row">
          <div>
            <p className="eyebrow">Provider Side</p>
            <h2>{session.user.name}</h2>
          </div>
          <span className="badge">{session.user.providerProfile?.cnic}</span>
        </div>

        <div className="form-grid">
          <input
            placeholder="Current latitude"
            value={location.latitude}
            onChange={(event) => setLocation({ ...location, latitude: event.target.value })}
          />
          <input
            placeholder="Current longitude"
            value={location.longitude}
            onChange={(event) => setLocation({ ...location, longitude: event.target.value })}
          />
          <button className="primary-button" onClick={updateLocation}>
            Refresh Nearby Requests
          </button>
        </div>

        {message ? <p className="status">{message}</p> : null}
      </section>

      <section className="panel wide">
        <div className="title-row">
          <h3>Requests Within 3-4 km</h3>
          <span className="badge">{requests.length} active</span>
        </div>

        <RequestMap
          userLocation={[Number(location.latitude), Number(location.longitude)]}
          nearbyRequests={requests}
        />

        <div className="offer-list">
          {requests.map((request) => (
            <article className="offer-card request-card" key={request.id}>
              <div>
                <h4>{request.serviceName}</h4>
                <p>{request.description}</p>
                <p>Vehicle: {request.vehicleNumber}</p>
                <p>
                  Distance: {request.distanceKm} km | Extra charge: PKR {request.extraDistanceCharge}
                </p>
              </div>
              <div className="form-grid compact">
                <input
                  placeholder="Price"
                  value={offerDrafts[request.id]?.price || ""}
                  onChange={(event) =>
                    setOfferDrafts({
                      ...offerDrafts,
                      [request.id]: { ...offerDrafts[request.id], price: event.target.value },
                    })
                  }
                />
                <input
                  placeholder="ETA minutes"
                  value={offerDrafts[request.id]?.estimatedMinutes || ""}
                  onChange={(event) =>
                    setOfferDrafts({
                      ...offerDrafts,
                      [request.id]: {
                        ...offerDrafts[request.id],
                        estimatedMinutes: event.target.value,
                      },
                    })
                  }
                />
                <textarea
                  placeholder="Offer message"
                  value={offerDrafts[request.id]?.message || ""}
                  onChange={(event) =>
                    setOfferDrafts({
                      ...offerDrafts,
                      [request.id]: { ...offerDrafts[request.id], message: event.target.value },
                    })
                  }
                />
                <button className="primary-button" onClick={() => sendOffer(request.id)}>
                  Send Price Offer
                </button>
              </div>
            </article>
          ))}

          {requests.length === 0 ? <p className="status">No requests found inside the provider radius.</p> : null}
        </div>
      </section>
    </div>
  );
}
