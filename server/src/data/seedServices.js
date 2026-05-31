import { defaultServices } from "./defaultServices.js";
import { Service } from "../models/Service.js";

export async function seedServices() {
  await Promise.all(
    defaultServices.map((service) =>
      Service.updateOne(
        { code: service.code },
        {
          $set: {
            name: service.name,
            description: service.description,
            pricing: service.pricing,
            config: service.config,
          },
        },
        { upsert: true }
      )
    )
  );
}
