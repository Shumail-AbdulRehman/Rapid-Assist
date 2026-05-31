import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      default: null,
      trim: true,
      maxlength: 240,
    },
  },
  { _id: false }
);

const extraWorkItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 400,
    },
    partsCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    laborCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    customerDecision: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    decisionAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: false }
);

const extraWorkRequestSchema = new mongoose.Schema(
  {
    providerNote: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "partially_approved", "rejected"],
      default: "pending",
    },
    requestedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    items: {
      type: [extraWorkItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    serviceCode: {
      type: String,
      enum: ["fuel_delivery", "car_towing", "mechanic"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "open",
        "assigned",
        "arrived",
        "inspection_pending",
        "awaiting_extra_work_approval",
        "in_progress",
        "awaiting_fuel_confirmation",
        "tow_in_transit",
        "completed",
        "cancelled",
      ],
      default: "open",
      index: true,
    },
    pickupLocation: {
      type: locationSchema,
      required: true,
    },
    destinationLocation: {
      type: locationSchema,
      default: null,
    },
    customerVehicle: {
      make: {
        type: String,
        default: null,
        trim: true,
        maxlength: 80,
      },
      model: {
        type: String,
        default: null,
        trim: true,
        maxlength: 80,
      },
      licensePlate: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40,
      },
      vehicleType: {
        type: String,
        enum: ["bike", "car"],
        default: null,
      },
      fuelType: {
        type: String,
        enum: ["petrol", "diesel"],
        default: null,
      },
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 800,
    },
    towingProblemType: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    mechanicCategory: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    fuelQuantityLiters: {
      type: Number,
      default: null,
      min: 0,
    },
    pricing: {
      currency: {
        type: String,
        default: "PKR",
      },
      fuelPricePerLiter: {
        type: Number,
        default: 0,
      },
      quantitySubtotal: {
        type: Number,
        default: 0,
      },
      deliveryFee: {
        type: Number,
        default: 0,
      },
      visitFee: {
        type: Number,
        default: 0,
      },
      towingBaseFee: {
        type: Number,
        default: 0,
      },
      perKmRate: {
        type: Number,
        default: 0,
      },
      routeDistanceKm: {
        type: Number,
        default: 0,
      },
      distanceCharge: {
        type: Number,
        default: 0,
      },
      extraWorkTotal: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    tracking: {
      providerLatitude: {
        type: Number,
        default: null,
      },
      providerLongitude: {
        type: Number,
        default: null,
      },
      providerUpdatedAt: {
        type: Date,
        default: null,
      },
      arrivedAt: {
        type: Date,
        default: null,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      fuelDeliveredAt: {
        type: Date,
        default: null,
      },
      fuelConfirmedAt: {
        type: Date,
        default: null,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      sosRaisedAt: {
        type: Date,
        default: null,
      },
      sosMessage: {
        type: String,
        default: null,
        trim: true,
        maxlength: 300,
      },
    },
    payment: {
      method: {
        type: String,
        enum: ["cash_on_delivery"],
        default: "cash_on_delivery",
      },
      customerConfirmed: {
        type: Boolean,
        default: false,
      },
      providerConfirmed: {
        type: Boolean,
        default: false,
      },
      customerConfirmedAt: {
        type: Date,
        default: null,
      },
      providerConfirmedAt: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "partially_confirmed", "confirmed"],
        default: "pending",
      },
    },
    extraWorkRequests: {
      type: [extraWorkRequestSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ customer: 1, status: 1, updatedAt: -1 });
orderSchema.index({ provider: 1, status: 1, updatedAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
