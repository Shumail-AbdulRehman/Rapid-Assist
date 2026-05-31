import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { seedServices } from "./data/seedServices.js";

dotenv.config();

const port = process.env.PORT || 4000;

async function startServer() {
  await connectDatabase();
  await seedServices();

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
