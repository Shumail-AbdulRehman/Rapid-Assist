const parsedRadius = Number(process.env.PROVIDER_RADIUS_KM || 300);

export const DEFAULT_PROVIDER_RADIUS_KM = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 300;
