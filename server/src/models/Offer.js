import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    message: {
      type: String,
      default: null,
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    extraDistanceCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ request: 1, provider: 1 }, { unique: true });

export const Offer = mongoose.model("Offer", offerSchema);
