import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  const secret = process.env.JWT_SECRET || "local-development-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}
