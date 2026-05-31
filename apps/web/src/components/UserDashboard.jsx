import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { RequestMap } from "./RequestMap";

const initialOrderForm = {
  serviceCode: "",
  pickupLatitude: "24.8607",
  pickupLongitude: "67.0011",
  pickupAddress: "",
  destinationLatitude: "24.8660",
  destinationLongitude: "67.0120",
  destinationAddress: "",
  vehicleMake: "",
  vehicleModel: "",
  licensePlate: "",
  vehicleType: "car",
  fuelType: "petrol",
  fuelQuantityLiters: "2",
  towingProblemType: "battery_dead",
  mechanicCategory: "general_repair",
  notes: "",
};

function titleFromCode(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value) {
  return `PKR ${Number(value || 0).toFixed(0)}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function getDistanceKm(fromLat, fromLng, toLat, toLng) {
  const values = [fromLat, fromLng, toLat, toLng].map(Number);

  if (!values.every(Number.isFinite)) {
    return 0;
  }

  const [lat1, lon1, lat2, lon2] = values;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return Number((12742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

function normalizeServiceOptions(form, service) {
  if (!service) {
    return form;
  }

  const next = { ...form, serviceCode: service.code };

  if (service.code === "fuel_delivery") {
    const vehicleTypes = service.config?.vehicleTypes || ["bike", "car"];
    const fuelTypes = service.config?.fuelTypes || ["petrol", "diesel"];
    const quantities = service.config?.quantities || [1, 2, 5, 10];

    next.vehicleType = vehicleTypes.includes(next.vehicleType) ? next.vehicleType : vehicleTypes[0];
    next.fuelType = fuelTypes.includes(next.fuelType) ? next.fuelType : fuelTypes[0];
    next.fuelQuantityLiters = quantities.map(String).includes(String(next.fuelQuantityLiters))
      ? String(next.fuelQuantityLiters)
      : String(quantities[0]);
  }

  if (service.code === "car_towing") {
    const problemTypes = service.config?.problemTypes || ["battery_dead"];
    next.towingProblemType = problemTypes.includes(next.towingProblemType)
      ? next.towingProblemType
      : problemTypes[0];
  }

  if (service.code === "mechanic") {
    const categories = service.config?.categories || [];
    const categoryCodes = categories.map((category) => category.code);
    next.mechanicCategory = categoryCodes.includes(next.mechanicCategory)
      ? next.mechanicCategory
      : categoryCodes[0] || "";
  }

  return next;
}

function buildEstimate(service, form) {
  if (!service) {
    return [];
  }

  if (service.code === "fuel_delivery") {
    const pricePerLiter = Number(service.pricing?.fuelPrices?.[form.fuelType] || 0);
    const quantity = Number(form.fuelQuantityLiters || 0);
    const deliveryFee = Number(service.pricing?.flatDeliveryFee || 0);

    return [
      ["Fuel", formatMoney(pricePerLiter * quantity)],
      ["Delivery", formatMoney(deliveryFee)],
      ["Estimated total", formatMoney(pricePerLiter * quantity + deliveryFee)],
    ];
  }

  if (service.code === "car_towing") {
    const routeDistanceKm = getDistanceKm(
      form.pickupLatitude,
      form.pickupLongitude,
      form.destinationLatitude,
      form.destinationLongitude
    );
    const visitFee = Number(service.pricing?.visitFee || 0);
    const towingBaseFee = Number(service.pricing?.towingBaseFee || 0);
    const distanceCharge = routeDistanceKm * Number(service.pricing?.perKmRate || 0);

    return [
      ["Route", `${routeDistanceKm} km`],
      ["Visit + base", formatMoney(visitFee + towingBaseFee)],
      ["Estimated total", formatMoney(visitFee + towingBaseFee + distanceCharge)],
    ];
  }

  if (service.code === "mechanic") {
    const category = (service.config?.categories || []).find((entry) => entry.code === form.mechanicCategory);
    const visitFee = Number(category?.visitFee || service.pricing?.defaultVisitFee || 0);

    return [
      ["Category", category?.name || "General repair"],
      ["Visit fee", formatMoney(visitFee)],
      ["Estimated total", formatMoney(visitFee)],
    ];
  }

  return [];
}

function OptionButtons({ label, options, value, onChange, formatLabel = titleFromCode }) {
  return (
    <div className="option-group">
      <p className="field-label">{label}</p>
      <div className="choice-buttons">
        {options.map((option) => {
          const optionValue = typeof option === "object" ? option.value : option;
          const optionLabel = typeof option === "object" ? option.label : formatLabel(option);

          return (
            <button
              key={optionValue}
              type="button"
              className={`choice-button ${String(value) === String(optionValue) ? "active" : ""}`}
              onClick={() => onChange(String(optionValue))}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UserDashboard({ session, services }) {
  const [orderForm, setOrderForm] = useState(initialOrderForm);
  const [activeOrder, setActiveOrder] = useState(null);
  const [message, setMessage] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.code === orderForm.serviceCode) || services[0] || null,
    [orderForm.serviceCode, services]
  );
  const pricingEstimate = useMemo(() => buildEstimate(selectedService, orderForm), [selectedService, orderForm]);
  const pickupLocation =
    activeOrder?.pickupLocation?.latitude != null && activeOrder?.pickupLocation?.longitude != null
      ? [Number(activeOrder.pickupLocation.latitude), Number(activeOrder.pickupLocation.longitude)]
      : null;
  const providerLocation =
    activeOrder?.tracking?.providerLatitude != null && activeOrder?.tracking?.providerLongitude != null
      ? [Number(activeOrder.tracking.providerLatitude), Number(activeOrder.tracking.providerLongitude)]
      : null;

  useEffect(() => {
    if (services.length === 0) {
      return;
    }

    setOrderForm((current) => {
      const service = services.find((entry) => entry.code === current.serviceCode) || services[0];
      return normalizeServiceOptions(current, service);
    });
  }, [services]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveOrder() {
      try {
        const response = await api.get("/orders/mine/active");

        if (!cancelled) {
          setActiveOrder(response.data.order);
        }
      } catch (_error) {
        if (!cancelled) {
          setActiveOrder(null);
        }
      }
    }

    loadActiveOrder();
    const timer = setInterval(loadActiveOrder, 7000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function updateOrderField(field, value) {
    setOrderForm((current) => ({ ...current, [field]: value }));
  }

  function selectService(service) {
    setOrderForm((current) => normalizeServiceOptions(current, service));
  }

  function validateOrder() {
    if (!selectedService) {
      return "Services are still loading";
    }

    if (!orderForm.licensePlate.trim()) {
      return "Vehicle registration number is required";
    }

    if (!isFiniteNumber(orderForm.pickupLatitude) || !isFiniteNumber(orderForm.pickupLongitude)) {
      return "Valid pickup latitude and longitude are required";
    }

    if (
      orderForm.serviceCode === "car_towing" &&
      (!isFiniteNumber(orderForm.destinationLatitude) ||
        !isFiniteNumber(orderForm.destinationLongitude) ||
        !orderForm.destinationAddress.trim())
    ) {
      return "Towing requires a destination address with valid latitude and longitude";
    }

    return "";
  }

  async function submitOrder(event) {
    event.preventDefault();

    const validationMessage = validateOrder();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setLoadingOrder(true);

    try {
      const payload = {
        serviceCode: orderForm.serviceCode,
        pickupLatitude: orderForm.pickupLatitude,
        pickupLongitude: orderForm.pickupLongitude,
        pickupAddress: orderForm.pickupAddress,
        vehicleMake: orderForm.vehicleMake,
        vehicleModel: orderForm.vehicleModel,
        licensePlate: orderForm.licensePlate,
        notes: orderForm.notes,
      };

      if (orderForm.serviceCode === "fuel_delivery") {
        payload.vehicleType = orderForm.vehicleType;
        payload.fuelType = orderForm.fuelType;
        payload.fuelQuantityLiters = Number(orderForm.fuelQuantityLiters);
      }

      if (orderForm.serviceCode === "car_towing") {
        payload.destinationLatitude = orderForm.destinationLatitude;
        payload.destinationLongitude = orderForm.destinationLongitude;
        payload.destinationAddress = orderForm.destinationAddress;
        payload.towingProblemType = orderForm.towingProblemType;
      }

      if (orderForm.serviceCode === "mechanic") {
        payload.mechanicCategory = orderForm.mechanicCategory;
      }

      const response = await api.post("/orders", payload);
      setActiveOrder(response.data.order);
      setMessage(`Request created. ${response.data.nearbyProvidersCount} provider(s) are currently in range.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not create request");
    } finally {
      setLoadingOrder(false);
    }
  }

  function renderServiceOptions() {
    if (!selectedService) {
      return <p className="status">Services are loading...</p>;
    }

    if (selectedService.code === "fuel_delivery") {
      return (
        <>
          <OptionButtons
            label="Vehicle type"
            options={selectedService.config?.vehicleTypes || ["bike", "car"]}
            value={orderForm.vehicleType}
            onChange={(value) => updateOrderField("vehicleType", value)}
          />
          <OptionButtons
            label="Fuel type"
            options={selectedService.config?.fuelTypes || ["petrol", "diesel"]}
            value={orderForm.fuelType}
            onChange={(value) => updateOrderField("fuelType", value)}
          />
          <OptionButtons
            label="Quantity"
            options={(selectedService.config?.quantities || [1, 2, 5, 10]).map((quantity) => ({
              value: String(quantity),
              label: `${quantity} liter${Number(quantity) === 1 ? "" : "s"}`,
            }))}
            value={orderForm.fuelQuantityLiters}
            onChange={(value) => updateOrderField("fuelQuantityLiters", value)}
          />
        </>
      );
    }

    if (selectedService.code === "car_towing") {
      return (
        <>
          <OptionButtons
            label="Problem type"
            options={selectedService.config?.problemTypes || ["battery_dead"]}
            value={orderForm.towingProblemType}
            onChange={(value) => updateOrderField("towingProblemType", value)}
          />
          <input
            placeholder="Destination address or workshop"
            value={orderForm.destinationAddress}
            onChange={(event) => updateOrderField("destinationAddress", event.target.value)}
          />
          <div className="form-row">
            <input
              placeholder="Destination latitude"
              value={orderForm.destinationLatitude}
              onChange={(event) => updateOrderField("destinationLatitude", event.target.value)}
            />
            <input
              placeholder="Destination longitude"
              value={orderForm.destinationLongitude}
              onChange={(event) => updateOrderField("destinationLongitude", event.target.value)}
            />
          </div>
        </>
      );
    }

    if (selectedService.code === "mechanic") {
      return (
        <OptionButtons
          label="Mechanic category"
          options={(selectedService.config?.categories || []).map((category) => ({
            value: category.code,
            label: `${category.name} - ${formatMoney(category.visitFee)}`,
          }))}
          value={orderForm.mechanicCategory}
          onChange={(value) => updateOrderField("mechanicCategory", value)}
        />
      );
    }

    return null;
  }

  return (
    <div className="shell dashboard-shell">
      <section className="panel wide">
        <div className="title-row">
          <div>
            <p className="eyebrow">Customer Side</p>
            <h2>Welcome, {session.user.name}</h2>
          </div>
          <span className="badge">{session.user.phone}</span>
        </div>

        <form className="form-grid" onSubmit={submitOrder}>
          <div className="service-choice-grid">
            {services.map((service) => (
              <button
                key={service.code}
                type="button"
                className={`service-choice ${orderForm.serviceCode === service.code ? "active" : ""}`}
                onClick={() => selectService(service)}
              >
                <span>{service.name}</span>
                <small>{service.description}</small>
              </button>
            ))}
          </div>

          {services.length === 0 ? <p className="status">No services found. Start the backend to load services.</p> : null}

          <div className="form-row">
            <input
              placeholder="Vehicle make"
              value={orderForm.vehicleMake}
              onChange={(event) => updateOrderField("vehicleMake", event.target.value)}
            />
            <input
              placeholder="Vehicle model"
              value={orderForm.vehicleModel}
              onChange={(event) => updateOrderField("vehicleModel", event.target.value)}
            />
          </div>
          <input
            placeholder="Vehicle registration number"
            value={orderForm.licensePlate}
            onChange={(event) => updateOrderField("licensePlate", event.target.value)}
          />

          <div className="service-options">{renderServiceOptions()}</div>

          <textarea
            placeholder="Pickup note or problem details"
            value={orderForm.notes}
            onChange={(event) => updateOrderField("notes", event.target.value)}
          />
          <input
            placeholder="Pickup address or landmark"
            value={orderForm.pickupAddress}
            onChange={(event) => updateOrderField("pickupAddress", event.target.value)}
          />
          <div className="form-row">
            <input
              placeholder="Pickup latitude"
              value={orderForm.pickupLatitude}
              onChange={(event) => updateOrderField("pickupLatitude", event.target.value)}
            />
            <input
              placeholder="Pickup longitude"
              value={orderForm.pickupLongitude}
              onChange={(event) => updateOrderField("pickupLongitude", event.target.value)}
            />
          </div>

          {pricingEstimate.length > 0 ? (
            <div className="estimate-panel">
              {pricingEstimate.map(([label, value]) => (
                <div className="estimate-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <button className="primary-button" type="submit" disabled={loadingOrder || !selectedService}>
            {loadingOrder ? "Creating request..." : "Request Assistance"}
          </button>
        </form>

        {message ? <p className="status">{message}</p> : null}
      </section>

      <section className="panel wide">
        <div className="title-row">
          <h3>Active Order</h3>
          <span className="badge">{activeOrder?.status || "No active order"}</span>
        </div>

        {activeOrder ? (
          <>
            <div className="map-card">
              <RequestMap
                userLocation={pickupLocation}
                providerLocation={providerLocation}
                nearbyProviders={activeOrder.nearbyProviders || []}
              />
            </div>

            <div className="offer-list">
              <article className="offer-card request-card">
                <div>
                  <h4>{activeOrder.serviceName}</h4>
                  <p>{activeOrder.notes || "No extra notes added."}</p>
                  <p>Vehicle: {activeOrder.customerVehicle?.licensePlate}</p>
                </div>
                <div>
                  <strong>{formatMoney(activeOrder.pricing?.total)}</strong>
                  <p>{titleFromCode(activeOrder.status)}</p>
                  <p>{activeOrder.orderNo}</p>
                </div>
                <span className="badge">{activeOrder.provider ? "Provider assigned" : "Finding provider"}</span>
              </article>

              {!activeOrder.provider && activeOrder.nearbyProviders?.length ? (
                <div className="nearby-list">
                  {activeOrder.nearbyProviders.map((provider) => (
                    <span className="provider-pill" key={provider.id}>
                      {provider.name} - {provider.distanceKm} km
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="status">Select a service and create a request to find nearby providers.</p>
        )}
      </section>
    </div>
  );
}
