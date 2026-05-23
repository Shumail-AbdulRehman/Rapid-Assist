import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const defaultDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/roadside_app";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || defaultDatabaseUrl,
});
