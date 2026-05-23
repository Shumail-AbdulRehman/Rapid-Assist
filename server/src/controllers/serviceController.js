import { pool } from "../config/db.js";

function getErrorMessage(error) {
  return error?.message || error?.code || error?.cause?.message || error?.cause?.code || String(error);
}

export async function getServices(_req, res) {
  try {
    const { rows } = await pool.query("SELECT id, name, base_price, extra_per_km FROM services ORDER BY id");

    return res.json(
      rows.map((service) => ({
        id: service.id,
        name: service.name,
        basePrice: Number(service.base_price),
        extraPerKm: Number(service.extra_per_km),
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch services", error: getErrorMessage(error) });
  }
}
