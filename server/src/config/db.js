import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: false });

const defaultMongoUrl = "mongodb://127.0.0.1:27017/roadside_app";

export async function connectDatabase() {
  const mongoUrl = process.env.MONGODB_URI || defaultMongoUrl;

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUrl);
}
