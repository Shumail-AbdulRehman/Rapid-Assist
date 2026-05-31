import { ProviderProfile } from "../models/index.js";
import { DEFAULT_PROVIDER_RADIUS_KM } from "../config/dispatch.js";
import { getDistanceKm } from "../utils/distance.js";

export async function findNearbyProviders(
  latitude,
  longitude,
  serviceCode,
  radiusKm = DEFAULT_PROVIDER_RADIUS_KM
) {
  const profiles = await ProviderProfile.find({
    isAvailable: true,
    currentLatitude: { $ne: null },
    currentLongitude: { $ne: null },
    ...(serviceCode ? { serviceCodes: serviceCode } : {}),
  })
    .populate("user", "name phone profilePicture role")
    .lean();

  return profiles
    .filter((profile) => profile.user?.role === "provider")
    .map((profile) => {
      const distanceKm = getDistanceKm(
        latitude,
        longitude,
        Number(profile.currentLatitude),
        Number(profile.currentLongitude)
      );

      return {
        id: profile.user._id.toString(),
        name: profile.user.name,
        phone: profile.user.phone,
        profilePicture: profile.user.profilePicture,
        isPremium: profile.isPremium,
        serviceCodes: profile.serviceCodes || [],
        currentLatitude: profile.currentLatitude,
        currentLongitude: profile.currentLongitude,
        distanceKm,
      };
    })
    .filter((provider) => provider.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
