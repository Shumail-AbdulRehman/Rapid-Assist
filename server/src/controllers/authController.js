import { pool } from "../config/db.js";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";

function getErrorMessage(error) {
  return error?.message || error?.code || error?.cause?.message || error?.cause?.code || String(error);
}

function sanitizeUser(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone,
    profilePicture: row.profile_picture,
  };
}

export async function register(req, res) {
  const {
    role,
    name,
    phone,
    password,
    profilePicture,
    workshopPicture,
    cnic,
    certificates,
    previousWorkHistory,
    reviewsSummary,
    latitude,
    longitude,
  } = req.body;

  if (!role || !name || !phone || !password) {
    return res.status(400).json({ message: "role, name, phone and password are required" });
  }

  if (role === "provider" && !cnic) {
    return res.status(400).json({ message: "CNIC is required for providers" });
  }

  try {
    const existingUser = await pool.query("SELECT id FROM users WHERE phone = $1", [phone]);

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (role, name, phone, password_hash, profile_picture)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, role, name, phone, profile_picture`,
        [role, name, phone, passwordHash, profilePicture || null]
      );

      const user = userResult.rows[0];

      if (role === "provider") {
        await client.query(
          `INSERT INTO provider_profiles
            (user_id, workshop_picture, cnic, certificates, previous_work_history, reviews_summary, current_latitude, current_longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.id,
            workshopPicture || null,
            cnic,
            certificates || null,
            previousWorkHistory || null,
            reviewsSummary || null,
            latitude ?? null,
            longitude ?? null,
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Registration successful",
        user: sanitizeUser(user),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Registration failed", error: getErrorMessage(error) });
  }
}

export async function login(req, res) {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "phone and password are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.role, u.name, u.phone, u.profile_picture, u.password_hash,
              p.workshop_picture, p.cnic, p.certificates, p.previous_work_history, p.reviews_summary, p.is_premium
       FROM users u
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       WHERE u.phone = $1`,
      [phone]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({ id: user.id, role: user.role, phone: user.phone });

    return res.json({
      token,
      user: {
        ...sanitizeUser(user),
        providerProfile:
          user.role === "provider"
            ? {
                workshopPicture: user.workshop_picture,
                cnic: user.cnic,
                certificates: user.certificates,
                previousWorkHistory: user.previous_work_history,
                reviewsSummary: user.reviews_summary,
                isPremium: user.is_premium,
              }
            : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: getErrorMessage(error) });
  }
}
