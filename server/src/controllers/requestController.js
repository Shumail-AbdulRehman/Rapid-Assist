import mongoose from "mongoose";
import { Offer, ProviderProfile, Service, ServiceRequest } from "../models/index.js";
import { findNearbyProviders } from "../services/providerService.js";
import { getDistanceKm, getExtraDistanceCharge } from "../utils/distance.js";

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function parseFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapOffer(offer) {
  const provider = offer.provider || {};

  return {
    id: offer._id.toString(),
    requestId: offer.request?._id?.toString() || offer.request?.toString(),
    providerId: provider._id?.toString() || offer.provider?.toString(),
    providerName: provider.name,
    price: Number(offer.price),
    estimatedMinutes: offer.estimatedMinutes,
    message: offer.message,
    distanceKm: Number(offer.distanceKm),
    extraDistanceCharge: Number(offer.extraDistanceCharge),
    status: offer.status,
  };
}

function mapRequest(request) {
  const service = request.service || {};
  const user = request.user || {};

  return {
    id: request._id.toString(),
    description: request.description,
    vehicleNumber: request.vehicleNumber,
    status: request.status,
    serviceName: service.name,
    latitude: Number(request.currentLatitude),
    longitude: Number(request.currentLongitude),
    userName: user.name,
    basePrice: Number(service.basePrice),
    extraPerKm: Number(service.extraPerKm),
    acceptedOfferId: request.acceptedOffer?.toString() || null,
  };
}

async function canProviderViewRequest(providerId, requestId) {
  return Boolean(await Offer.exists({ provider: providerId, request: requestId }));
}

export async function createRequest(req, res) {
  const { serviceId, description, vehicleNumber, latitude, longitude } = req.body;
  const currentLatitude = parseFiniteNumber(latitude);
  const currentLongitude = parseFiniteNumber(longitude);

  if (!serviceId || !description || !vehicleNumber || currentLatitude == null || currentLongitude == null) {
    return res.status(400).json({
      message: "serviceId, description, vehicleNumber, latitude and longitude are required",
    });
  }

  if (!isValidObjectId(serviceId)) {
    return res.status(400).json({ message: "Invalid serviceId" });
  }

  try {
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const request = await ServiceRequest.create({
      user: req.user.id,
      service: service._id,
      description,
      vehicleNumber,
      currentLatitude,
      currentLongitude,
    });

    await request.populate([
      { path: "service", select: "name basePrice extraPerKm" },
      { path: "user", select: "name" },
    ]);

    const nearbyProviders = await findNearbyProviders(currentLatitude, currentLongitude, 4);

    return res.status(201).json({
      request: mapRequest(request),
      nearbyProviders,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create request", error: error.message });
  }
}

export async function getRequestDetails(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid request id" });
  }

  try {
    const request = await ServiceRequest.findById(id)
      .populate("service", "name basePrice extraPerKm")
      .populate("user", "name")
      .lean();

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const isOwner = request.user?._id?.toString() === req.user.id;
    const providerCanView = req.user.role === "provider" && (await canProviderViewRequest(req.user.id, request._id));

    if (req.user.role === "user" && !isOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "provider" && !providerCanView) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const offers = await Offer.find({ request: request._id })
      .sort({ createdAt: 1 })
      .populate("provider", "name")
      .lean();

    let acceptedProviderLocation = null;

    if (request.acceptedOffer) {
      const acceptedOffer = await Offer.findById(request.acceptedOffer).lean();

      if (acceptedOffer) {
        const profile = await ProviderProfile.findOne({ user: acceptedOffer.provider }).lean();

        if (profile?.currentLatitude != null && profile?.currentLongitude != null) {
          acceptedProviderLocation = {
            latitude: Number(profile.currentLatitude),
            longitude: Number(profile.currentLongitude),
          };
        }
      }
    }

    return res.json({
      request: mapRequest(request),
      offers: offers.map(mapOffer),
      acceptedProviderLocation,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch request", error: error.message });
  }
}

export async function getNearbyRequests(req, res) {
  const latitude = parseFiniteNumber(req.query.latitude);
  const longitude = parseFiniteNumber(req.query.longitude);
  const radiusKm = parseFiniteNumber(req.query.radiusKm || 4);

  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: "latitude and longitude query params are required" });
  }

  if (radiusKm == null || radiusKm <= 0 || radiusKm > 50) {
    return res.status(400).json({ message: "radiusKm must be a number between 0 and 50" });
  }

  try {
    const requests = await ServiceRequest.find({ status: { $in: ["pending", "offered"] } })
      .sort({ createdAt: -1 })
      .populate("service", "name basePrice extraPerKm")
      .populate("user", "name")
      .lean();

    const nearby = requests
      .map((request) => {
        const distanceKm = getDistanceKm(
          latitude,
          longitude,
          Number(request.currentLatitude),
          Number(request.currentLongitude)
        );

        const extraDistanceCharge = getExtraDistanceCharge(distanceKm, Number(request.service.extraPerKm));

        return {
          id: request._id.toString(),
          userName: request.user.name,
          serviceName: request.service.name,
          description: request.description,
          vehicleNumber: request.vehicleNumber,
          latitude: Number(request.currentLatitude),
          longitude: Number(request.currentLongitude),
          status: request.status,
          distanceKm,
          suggestedBasePrice: Number(request.service.basePrice),
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
  const offerPrice = parseFiniteNumber(price);
  const etaMinutes = parseFiniteNumber(estimatedMinutes);

  if (!requestId || offerPrice == null || etaMinutes == null) {
    return res.status(400).json({ message: "requestId, price and estimatedMinutes are required" });
  }

  if (!isValidObjectId(requestId)) {
    return res.status(400).json({ message: "Invalid requestId" });
  }

  if (offerPrice <= 0 || etaMinutes <= 0) {
    return res.status(400).json({ message: "price and estimatedMinutes must be greater than zero" });
  }

  try {
    const request = await ServiceRequest.findById(requestId).populate("service", "extraPerKm");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (!["pending", "offered"].includes(request.status)) {
      return res.status(409).json({ message: "Request is no longer accepting offers" });
    }

    const providerProfile = await ProviderProfile.findOne({ user: req.user.id });

    if (!providerProfile) {
      return res.status(404).json({ message: "Provider profile missing" });
    }

    if (providerProfile.currentLatitude == null || providerProfile.currentLongitude == null) {
      return res.status(400).json({ message: "Provider location must be set before sending offers" });
    }

    const distanceKm = getDistanceKm(
      Number(request.currentLatitude),
      Number(request.currentLongitude),
      Number(providerProfile.currentLatitude),
      Number(providerProfile.currentLongitude)
    );

    if (distanceKm > 4) {
      return res.status(403).json({ message: "Request is outside the provider discovery radius" });
    }

    const extraDistanceCharge = getExtraDistanceCharge(distanceKm, Number(request.service.extraPerKm));

    const offer = await Offer.create({
      request: request._id,
      provider: req.user.id,
      price: offerPrice,
      estimatedMinutes: Math.round(etaMinutes),
      message: message || null,
      distanceKm,
      extraDistanceCharge,
    });

    if (request.status === "pending") {
      request.status = "offered";
      await request.save();
    }

    return res.status(201).json({
      offer: {
        ...offer.toObject(),
        id: offer._id.toString(),
        requestId: request._id.toString(),
        providerId: req.user.id,
        distanceKm,
        extraDistanceCharge,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Provider has already sent an offer for this request" });
    }

    return res.status(500).json({ message: "Unable to create offer", error: error.message });
  }
}

export async function acceptOffer(req, res) {
  const offerId = req.params.offerId;

  if (!isValidObjectId(offerId)) {
    return res.status(400).json({ message: "Invalid offer id" });
  }

  try {
    const offer = await Offer.findById(offerId).populate("request");

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const request = offer.request;

    if (request.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!["pending", "offered"].includes(request.status) || offer.status !== "pending") {
      return res.status(409).json({ message: "Offer can no longer be accepted" });
    }

    await Offer.updateOne({ _id: offer._id }, { status: "accepted" });
    await Offer.updateMany({ request: request._id, _id: { $ne: offer._id } }, { status: "rejected" });
    await ServiceRequest.updateOne(
      { _id: request._id },
      { status: "accepted", acceptedOffer: offer._id }
    );

    return res.json({ message: "Offer accepted", offerId });
  } catch (error) {
    return res.status(500).json({ message: "Unable to accept offer", error: error.message });
  }
}

export async function updateProviderLocation(req, res) {
  const latitude = parseFiniteNumber(req.body.latitude);
  const longitude = parseFiniteNumber(req.body.longitude);
  const { isAvailable } = req.body;

  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: "latitude and longitude are required" });
  }

  try {
    const update = {
      currentLatitude: latitude,
      currentLongitude: longitude,
    };

    if (typeof isAvailable === "boolean") {
      update.isAvailable = isAvailable;
    }

    const profile = await ProviderProfile.findOneAndUpdate({ user: req.user.id }, update, {
      new: true,
      runValidators: true,
    });

    if (!profile) {
      return res.status(404).json({ message: "Provider profile missing" });
    }

    return res.json({ message: "Provider location updated" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update location", error: error.message });
  }
}
