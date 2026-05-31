import { getDistanceKm } from "./distance.js";

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function calculateFuelPricing(service, fuelType, quantityLiters) {
  const fuelPricePerLiter = Number(service.pricing?.fuelPrices?.[fuelType] || 0);
  const deliveryFee = Number(service.pricing?.flatDeliveryFee || 0);
  const quantitySubtotal = toMoney(fuelPricePerLiter * quantityLiters);

  return {
    currency: service.pricing?.currency || "PKR",
    fuelPricePerLiter,
    quantitySubtotal,
    deliveryFee,
    visitFee: 0,
    towingBaseFee: 0,
    perKmRate: 0,
    routeDistanceKm: 0,
    distanceCharge: 0,
    extraWorkTotal: 0,
    total: toMoney(quantitySubtotal + deliveryFee),
  };
}

export function calculateTowingPricing(service, pickupLocation, destinationLocation) {
  const visitFee = Number(service.pricing?.visitFee || 0);
  const towingBaseFee = Number(service.pricing?.towingBaseFee || 0);
  const perKmRate = Number(service.pricing?.perKmRate || 0);
  const routeDistanceKm = getDistanceKm(
    pickupLocation.latitude,
    pickupLocation.longitude,
    destinationLocation.latitude,
    destinationLocation.longitude
  );
  const distanceCharge = toMoney(routeDistanceKm * perKmRate);

  return {
    currency: service.pricing?.currency || "PKR",
    fuelPricePerLiter: 0,
    quantitySubtotal: 0,
    deliveryFee: 0,
    visitFee,
    towingBaseFee,
    perKmRate,
    routeDistanceKm,
    distanceCharge,
    extraWorkTotal: 0,
    total: toMoney(visitFee + towingBaseFee + distanceCharge),
  };
}

export function calculateMechanicPricing(service, categoryCode, approvedExtraWorkTotal = 0) {
  const categories = service.config?.categories || [];
  const category = categories.find((entry) => entry.code === categoryCode);
  const visitFee = Number(category?.visitFee || service.pricing?.defaultVisitFee || 0);
  const extraWorkTotal = toMoney(approvedExtraWorkTotal);

  return {
    currency: service.pricing?.currency || "PKR",
    fuelPricePerLiter: 0,
    quantitySubtotal: 0,
    deliveryFee: 0,
    visitFee,
    towingBaseFee: 0,
    perKmRate: 0,
    routeDistanceKm: 0,
    distanceCharge: 0,
    extraWorkTotal,
    total: toMoney(visitFee + extraWorkTotal),
  };
}
