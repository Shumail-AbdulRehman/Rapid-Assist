import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    currentLatitude: {
      type: Number,
      required: true,
    },
    currentLongitude: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "offered", "accepted", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);
