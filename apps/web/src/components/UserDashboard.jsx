import { useEffect, useState } from "react";
import api from "../api";
import { RequestMap } from "./RequestMap";

const initialRequest = {
  serviceId: "",
  description: "",
  vehicleNumber: "",
  latitude: "24.8607",
  longitude: "67.0011",
};

export function UserDashboard({ session, services }) {
  const [requestForm, setRequestForm] = useState(initialRequest);
  const [activeRequest, setActiveRequest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [providerLocation, setProviderLocation] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!activeRequest?.id) {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/requests/${activeRequest.id}`);
        setActiveRequest(response.data.request);
        setOffers(response.data.offers);
        setProviderLocation(response.data.acceptedProviderLocation);
      } catch (_error) {
        return undefined;
      }
    }, 7000);

    return () => clearInterval(timer);
  }, [activeRequest?.id]);

  async function submitRequest(event) {
    event.preventDefault();

    try {
      const response = await api.post("/requests", requestForm);
      setActiveRequest(response.data.request);
      setOffers([]);
      setMessage(`${response.data.nearbyProviders.length} nearby providers found`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not create request");
    }
  }

  async function acceptOffer(offerId) {
    try {
      await api.post(`/requests/offers/${offerId}/accept`);
      const response = await api.get(`/requests/${activeRequest.id}`);
      setActiveRequest(response.data.request);
      setOffers(response.data.offers);
      setProviderLocation(response.data.acceptedProviderLocation);
      setMessage("Offer accepted. Provider is on the way.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not accept offer");
    }
  }

  return (
    <div className="shell dashboard-shell">
      <section className="panel wide">
        <div className="title-row">
          <div>
            <p className="eyebrow">User Side</p>
            <h2>Welcome, {session.user.name}</h2>
          </div>
          <span className="badge">{session.user.phone}</span>
        </div>

        <form className="form-grid" onSubmit={submitRequest}>
          <select
            value={requestForm.serviceId}
            onChange={(event) => setRequestForm({ ...requestForm, serviceId: event.target.value })}
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Vehicle registration number"
            value={requestForm.vehicleNumber}
            onChange={(event) => setRequestForm({ ...requestForm, vehicleNumber: event.target.value })}
          />
          <textarea
            placeholder="Describe the problem"
            value={requestForm.description}
            onChange={(event) => setRequestForm({ ...requestForm, description: event.target.value })}
          />
          <input
            placeholder="Latitude"
            value={requestForm.latitude}
            onChange={(event) => setRequestForm({ ...requestForm, latitude: event.target.value })}
          />
          <input
            placeholder="Longitude"
            value={requestForm.longitude}
            onChange={(event) => setRequestForm({ ...requestForm, longitude: event.target.value })}
          />
          <button className="primary-button" type="submit">
            Request Assistance
          </button>
        </form>

        {message ? <p className="status">{message}</p> : null}
      </section>

      <section className="panel wide">
        <div className="title-row">
          <h3>Offers and Tracking</h3>
          <span className="badge">{activeRequest?.status || "No active request"}</span>
        </div>

        {activeRequest ? (
          <>
            <div className="map-card">
              <RequestMap
                userLocation={[Number(activeRequest.latitude), Number(activeRequest.longitude)]}
                providerLocation={
                  providerLocation ? [Number(providerLocation.latitude), Number(providerLocation.longitude)] : null
                }
              />
            </div>

            <div className="offer-list">
              {offers.length === 0 ? <p className="status">Waiting for provider offers...</p> : null}
              {offers.map((offer) => (
                <article className="offer-card" key={offer.id}>
                  <div>
                    <h4>{offer.providerName}</h4>
                    <p>{offer.message || "Ready to help immediately"}</p>
                  </div>
                  <div>
                    <strong>PKR {offer.price + offer.extraDistanceCharge}</strong>
                    <p>{offer.estimatedMinutes} mins ETA</p>
                    <p>{offer.distanceKm} km away</p>
                  </div>
                  {offer.status === "pending" ? (
                    <button className="primary-button" onClick={() => acceptOffer(offer.id)}>
                      Accept Offer
                    </button>
                  ) : (
                    <span className="badge">{offer.status}</span>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="status">Submit a request to start receiving bids.</p>
        )}
      </section>
    </div>
  );
}
