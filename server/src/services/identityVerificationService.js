import { verifyProviderIdentityLocally } from "./localIdentityVerificationService.js";

function normalizeCnic(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCnicNumber(value) {
  return /^\d{13}$/.test(normalizeCnic(value));
}

function buildFailure(reason, details = {}) {
  return {
    ok: false,
    reason,
    ...details,
  };
}

export async function verifyProviderIdentity(input) {
  if (!isValidCnicNumber(input.cnic)) {
    return buildFailure("CNIC number must contain exactly 13 digits");
  }

  if (!input.cnicFrontImage || !input.cnicBackImage || !input.selfieImage) {
    return buildFailure("CNIC front, CNIC back, and selfie images are all required");
  }

  const provider = process.env.IDENTITY_VERIFICATION_PROVIDER || "local";

  if (provider !== "local") {
    return buildFailure(
      `Unsupported identity verification provider: ${provider}. Phase 1 only supports local verification.`
    );
  }

  return verifyProviderIdentityLocally(input);
}

export { isValidCnicNumber, normalizeCnic };
