import { Service } from "../models/index.js";

function getErrorMessage(error) {
  return error?.message || error?.code || error?.cause?.message || error?.cause?.code || String(error);
}

export async function getServices(_req, res) {
  try {
    const services = await Service.find().sort({ createdAt: 1 }).lean();

    return res.json(
      services.map((service) => ({
        id: service._id.toString(),
        code: service.code,
        name: service.name,
        description: service.description,
        pricing: service.pricing,
        config: service.config,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch services", error: getErrorMessage(error) });
  }
}
