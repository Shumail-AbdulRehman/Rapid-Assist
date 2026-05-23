import { pool } from "../config/db.js";
import { getDistanceKm } from "../utils/distance.js";

export async function findNearbyProviders(latitude, longitude, radiusKm = 4) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.phone, u.profile_picture, p.is_premium, p.current_latitude, p.current_longitude
     FROM users u
     JOIN provider_profiles p ON p.user_id = u.id
     WHERE u.role = 'provider' AND p.is_available = TRUE
       AND p.current_latitude IS NOT NULL AND p.current_longitude IS NOT NULL`
  );

  return rows
    .map((provider) => {
      const distanceKm = getDistanceKm(
        latitude,
        longitude,
        Number(provider.current_latitude),
        Number(provider.current_longitude)
      );

      return {
        ...provider,
        distanceKm,
      };
    })
    .filter((provider) => provider.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
