import { pool } from "../config/db.js";
import { findNearbyProviders } from "../services/providerService.js";
import { getDistanceKm, getExtraDistanceCharge } from "../utils/distance.js";

function mapOffer(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    price: Number(row.price),
    estimatedMinutes: row.estimated_minutes,
    message: row.message,
    distanceKm: Number(row.distance_km),
    extraDistanceCharge: Number(row.extra_distance_charge),
    status: row.status,
  };
}

export async function createRequest(req, res) {
  const { serviceId, description, vehicleNumber, latitude, longitude } = req.body;

  if (!serviceId || !description || !vehicleNumber || latitude == null || longitude == null) {
    return res.status(400).json({
      message: "serviceId, description, vehicleNumber, latitude and longitude are required",
    });
  }

  try {
    const requestResult = await pool.query(
      `INSERT INTO service_requests
        (user_id, service_id, description, vehicle_number, current_latitude, current_longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, serviceId, description, vehicleNumber, latitude, longitude]
    );

    const nearbyProviders = await findNearbyProviders(Number(latitude), Number(longitude), 4);

    return res.status(201).json({
      request: requestResult.rows[0],
      nearbyProviders,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create request", error: error.message });
  }
}

export async function getRequestDetails(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT sr.*, s.name AS service_name, s.base_price, s.extra_per_km,
              u.name AS user_name
       FROM service_requests sr
       JOIN services s ON s.id = sr.service_id
       JOIN users u ON u.id = sr.user_id
       WHERE sr.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const request = rows[0];
    const offersResult = await pool.query(
      `SELECT o.*, provider.name AS provider_name
       FROM offers o
       JOIN users provider ON provider.id = o.provider_id
       WHERE o.request_id = $1
       ORDER BY o.created_at ASC`,
      [req.params.id]
    );

    let acceptedProviderLocation = null;

    if (request.accepted_offer_id) {
      const locationResult = await pool.query(
        `SELECT p.current_latitude, p.current_longitude
         FROM offers o
         JOIN provider_profiles p ON p.user_id = o.provider_id
         WHERE o.id = $1`,
        [request.accepted_offer_id]
      );

      if (locationResult.rows[0]) {
        acceptedProviderLocation = {
          latitude: Number(locationResult.rows[0].current_latitude),
          longitude: Number(locationResult.rows[0].current_longitude),
        };
      }
    }

    return res.json({
      request: {
        id: request.id,
        description: request.description,
        vehicleNumber: request.vehicle_number,
        status: request.status,
        serviceName: request.service_name,
        latitude: Number(request.current_latitude),
        longitude: Number(request.current_longitude),
        userName: request.user_name,
        basePrice: Number(request.base_price),
        extraPerKm: Number(request.extra_per_km),
        acceptedOfferId: request.accepted_offer_id,
      },
      offers: offersResult.rows.map(mapOffer),
      acceptedProviderLocation,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch request", error: error.message });
  }
}

export async function getNearbyRequests(req, res) {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radiusKm = Number(req.query.radiusKm || 4);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return res.status(400).json({ message: "latitude and longitude query params are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT sr.*, s.name AS service_name, s.base_price, s.extra_per_km, u.name AS user_name
       FROM service_requests sr
       JOIN services s ON s.id = sr.service_id
       JOIN users u ON u.id = sr.user_id
       WHERE sr.status IN ('pending', 'offered')
       ORDER BY sr.created_at DESC`
    );

    const nearby = rows
      .map((request) => {
        const distanceKm = getDistanceKm(
          latitude,
          longitude,
          Number(request.current_latitude),
          Number(request.current_longitude)
        );

        const extraDistanceCharge = getExtraDistanceCharge(distanceKm, Number(request.extra_per_km));

        return {
          id: request.id,
          userName: request.user_name,
          serviceName: request.service_name,
          description: request.description,
          vehicleNumber: request.vehicle_number,
          latitude: Number(request.current_latitude),
          longitude: Number(request.current_longitude),
          status: request.status,
          distanceKm,
          suggestedBasePrice: Number(request.base_price),
          extraDistanceCharge,
        };
      })
      .filter((request) => request.distanceKm <= radiusKm);

    return res.json(nearby);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch nearby requests", error: error.message });
  }
}

export async function createOffer(req, res) {
  const { requestId, price, estimatedMinutes, message } = req.body;

  if (!requestId || !price || !estimatedMinutes) {
    return res.status(400).json({ message: "requestId, price and estimatedMinutes are required" });
  }

  try {
    const requestResult = await pool.query(
      `SELECT sr.current_latitude AS request_latitude,
              sr.current_longitude AS request_longitude,
              s.extra_per_km,
              p.current_latitude AS provider_latitude,
              p.current_longitude AS provider_longitude
       FROM service_requests sr
       JOIN services s ON s.id = sr.service_id
       JOIN provider_profiles p ON p.user_id = $2
       WHERE sr.id = $1`,
      [requestId, req.user.id]
    );

    const request = requestResult.rows[0];

    if (!request) {
      return res.status(404).json({ message: "Request not found or provider profile missing" });
    }

    if (request.provider_latitude == null || request.provider_longitude == null) {
      return res.status(400).json({ message: "Provider location must be set before sending offers" });
    }

    const distanceKm = getDistanceKm(
      Number(request.request_latitude),
      Number(request.request_longitude),
      Number(request.provider_latitude),
      Number(request.provider_longitude)
    );

    const extraDistanceCharge = getExtraDistanceCharge(distanceKm, Number(request.extra_per_km));

    const offerResult = await pool.query(
      `INSERT INTO offers
        (request_id, provider_id, price, estimated_minutes, message, distance_km, extra_distance_charge)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [requestId, req.user.id, price, estimatedMinutes, message || null, distanceKm, extraDistanceCharge]
    );

    await pool.query("UPDATE service_requests SET status = 'offered' WHERE id = $1", [requestId]);

    return res.status(201).json({
      offer: {
        ...offerResult.rows[0],
        distanceKm,
        extraDistanceCharge,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create offer", error: error.message });
  }
}

export async function acceptOffer(req, res) {
  const offerId = Number(req.params.offerId);

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const offerResult = await client.query("SELECT * FROM offers WHERE id = $1", [offerId]);
      const offer = offerResult.rows[0];

      if (!offer) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Offer not found" });
      }

      await client.query("UPDATE offers SET status = 'accepted' WHERE id = $1", [offerId]);
      await client.query(
        "UPDATE offers SET status = 'rejected' WHERE request_id = $1 AND id <> $2",
        [offer.request_id, offerId]
      );
      await client.query(
        "UPDATE service_requests SET status = 'accepted', accepted_offer_id = $1 WHERE id = $2",
        [offerId, offer.request_id]
      );

      await client.query("COMMIT");

      return res.json({ message: "Offer accepted", offerId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Unable to accept offer", error: error.message });
  }
}

export async function updateProviderLocation(req, res) {
  const { latitude, longitude, isAvailable } = req.body;

  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: "latitude and longitude are required" });
  }

  try {
    await pool.query(
      `UPDATE provider_profiles
       SET current_latitude = $1, current_longitude = $2, is_available = COALESCE($3, is_available)
       WHERE user_id = $4`,
      [latitude, longitude, isAvailable, req.user.id]
    );

    return res.json({ message: "Provider location updated" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update location", error: error.message });
  }
}
