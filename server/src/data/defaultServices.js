export const defaultServices = [
  {
    code: "fuel_delivery",
    name: "Fuel Delivery",
    description: "Emergency fuel delivery for cars and bikes across Lahore.",
    pricing: {
      currency: "PKR",
      flatDeliveryFee: 250,
      fuelPrices: {
        petrol: 272,
        diesel: 280,
      },
    },
    config: {
      fuelTypes: ["petrol", "diesel"],
      vehicleTypes: ["bike", "car"],
      quantities: [1, 2, 5, 10],
    },
  },
  {
    code: "car_towing",
    name: "Car Towing",
    description: "Tow vehicle from pickup point to workshop or destination.",
    pricing: {
      currency: "PKR",
      visitFee: 600,
      towingBaseFee: 2200,
      perKmRate: 180,
    },
    config: {
      problemTypes: [
        "accident",
        "flat_tyre",
        "battery_dead",
        "engine_not_starting",
        "other",
      ],
    },
  },
  {
    code: "mechanic",
    name: "Mechanic Service",
    description: "On-demand roadside mechanic with visit fee and extra work approval.",
    pricing: {
      currency: "PKR",
      defaultVisitFee: 800,
    },
    config: {
      categories: [
        { code: "general_repair", name: "General Repair", visitFee: 800 },
        { code: "battery_jump_start", name: "Battery Jump Start", visitFee: 700 },
        { code: "ac_repair", name: "AC Repair", visitFee: 1000 },
        { code: "lockout", name: "Lockout", visitFee: 650 },
        { code: "brake_check", name: "Brake Check", visitFee: 850 },
      ],
    },
  },
];
