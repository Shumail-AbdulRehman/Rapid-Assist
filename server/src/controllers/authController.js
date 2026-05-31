import { ProviderProfile, User } from "../models/index.js";
import {
  isValidCnicNumber,
  normalizeCnic,
  verifyProviderIdentity,
} from "../services/identityVerificationService.js";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";

function getErrorMessage(error) {
  return error?.message || error?.code || error?.cause?.message || error?.cause?.code || String(error);
}

function sanitizeUser(row) {
  return {
    id: row.id || row._id?.toString(),
    role: row.role,
    name: row.name,
    phone: row.phone,
    profilePicture: row.profilePicture,
  };
}

function sanitizeProviderProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    workshopPicture: profile.workshopPicture || null,
    mechanicCertificateImage: profile.mechanicCertificateImage || null,
    cnicFrontImage: profile.cnicFrontImage || null,
    cnicBackImage: profile.cnicBackImage || null,
    selfieImage: profile.selfieImage || null,
    cnic: profile.cnic || null,
    cnicVerificationStatus: profile.cnicVerificationStatus || "rejected",
    cnicVerificationReason: profile.cnicVerificationReason || null,
    cnicVerificationProvider: profile.cnicVerificationProvider || null,
    cnicVerifiedAt: profile.cnicVerifiedAt || null,
    cnicExtractedNumber: profile.cnicExtractedNumber || null,
    cnicFaceSimilarity:
      typeof profile.cnicFaceSimilarity === "number" ? profile.cnicFaceSimilarity : null,
    isPremium: profile.isPremium || false,
    serviceCodes: profile.serviceCodes || [],
    city: profile.city || "Lahore",
    currentLatitude: profile.currentLatitude ?? null,
    currentLongitude: profile.currentLongitude ?? null,
    isAvailable: profile.isAvailable ?? true,
  };
}

function buildAuthResponse(user, providerProfile = null) {
  const token = signToken({ id: user.id, role: user.role, phone: user.phone });

  return {
    token,
    user: {
      ...sanitizeUser(user),
      providerProfile: user.role === "provider" ? sanitizeProviderProfile(providerProfile) : null,
    },
  };
}

function optionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function register(req, res) {
  const {
    role,
    name,
    phone,
    password,
    profilePicture,
    workshopPicture,
    mechanicCertificateImage,
    cnicFrontImage,
    cnicBackImage,
    selfieImage,
    cnic,
    latitude,
    longitude,
    serviceCodes,
    city,
  } = req.body;

  if (!role || !name || !phone || !password) {
    return res.status(400).json({ message: "role, name, phone and password are required" });
  }

  if (!["user", "provider"].includes(role)) {
    return res.status(400).json({ message: "role must be user or provider" });
  }

  if (role === "provider" && !cnic?.trim()) {
    return res.status(400).json({ message: "CNIC number is required for providers" });
  }

  if (role === "provider" && !isValidCnicNumber(cnic)) {
    return res.status(400).json({ message: "CNIC number must contain exactly 13 digits" });
  }

  if (role === "provider" && !cnicFrontImage?.trim()) {
    return res.status(400).json({ message: "CNIC front image is required for providers" });
  }

  if (role === "provider" && !cnicBackImage?.trim()) {
    return res.status(400).json({ message: "CNIC back image is required for providers" });
  }

  if (role === "provider" && !selfieImage?.trim()) {
    return res.status(400).json({ message: "Live selfie image is required for providers" });
  }

  if (role === "provider" && !workshopPicture?.trim()) {
    return res.status(400).json({ message: "Workshop picture is required for providers" });
  }

  if (role === "provider" && (!Array.isArray(serviceCodes) || serviceCodes.length === 0)) {
    return res.status(400).json({ message: "At least one provider service must be selected" });
  }

  if (
    role === "provider" &&
    Array.isArray(serviceCodes) &&
    serviceCodes.includes("mechanic") &&
    !mechanicCertificateImage?.trim()
  ) {
    return res.status(400).json({ message: "Mechanic certificate image is required for mechanic providers" });
  }

  try {
    const existingUser = await User.exists({ phone });

    if (existingUser) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    let verification = null;

    if (role === "provider") {
      verification = await verifyProviderIdentity({
        name,
        cnic,
        cnicFrontImage,
        cnicBackImage,
        selfieImage,
      });

      if (!verification.ok) {
        return res.status(400).json({
          message: verification.reason || "Provider identity verification failed",
          verification: {
            provider: verification.provider || process.env.IDENTITY_VERIFICATION_PROVIDER || "local",
            extractedCnic: verification.extractedCnic || null,
            faceSimilarity:
              typeof verification.faceSimilarity === "number" ? verification.faceSimilarity : null,
            verificationRef: verification.verificationRef || null,
          },
        });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      role,
      name,
      phone,
      passwordHash,
      profilePicture: profilePicture || null,
    });

    try {
      if (role === "provider") {
        await ProviderProfile.create({
          user: user._id,
          workshopPicture: workshopPicture || null,
          mechanicCertificateImage: mechanicCertificateImage || null,
          cnicFrontImage: cnicFrontImage || null,
          cnicBackImage: cnicBackImage || null,
          selfieImage: selfieImage || null,
          cnic: normalizeCnic(cnic),
          cnicVerificationStatus: "verified",
          cnicVerificationReason: null,
          cnicVerificationProvider: verification?.provider || null,
          cnicVerifiedAt: new Date(),
          cnicExtractedNumber: verification?.extractedCnic || normalizeCnic(cnic),
          cnicFaceSimilarity:
            typeof verification?.faceSimilarity === "number" ? verification.faceSimilarity : null,
          serviceCodes: [...new Set(serviceCodes || [])],
          city: city?.trim() || "Lahore",
          currentLatitude: optionalNumber(latitude),
          currentLongitude: optionalNumber(longitude),
        });
      }

      return res.status(201).json({
        message: "Registration successful",
        user: sanitizeUser(user),
      });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    return res.status(500).json({ message: "Registration failed", error: getErrorMessage(error) });
  }
}

export async function login(req, res) {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "phone and password are required" });
  }

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const providerProfile =
      user.role === "provider" ? await ProviderProfile.findOne({ user: user._id }).lean() : null;

    return res.json(buildAuthResponse(user, providerProfile));
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: getErrorMessage(error) });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const providerProfile =
      user.role === "provider" ? await ProviderProfile.findOne({ user: user._id }).lean() : null;

    return res.json({
      user: {
        ...sanitizeUser(user),
        providerProfile: user.role === "provider" ? sanitizeProviderProfile(providerProfile) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load profile", error: getErrorMessage(error) });
  }
}

export async function updateMe(req, res) {
  const {
    name,
    profilePicture,
    workshopPicture,
    mechanicCertificateImage,
    cnicFrontImage,
    cnicBackImage,
    selfieImage,
    cnic,
    city,
    serviceCodes,
  } = req.body;

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof name === "string" && name.trim()) {
      user.name = name.trim();
    }

    if (typeof profilePicture === "string") {
      user.profilePicture = profilePicture.trim() || null;
    }

    await user.save();

    let providerProfile = null;

    if (user.role === "provider") {
      providerProfile = await ProviderProfile.findOne({ user: user._id });
      let identityFieldsChanged = false;

      if (!providerProfile) {
        return res.status(404).json({ message: "Provider profile missing" });
      }

      if (typeof workshopPicture === "string") {
        providerProfile.workshopPicture = workshopPicture.trim() || null;
      }

      if (typeof mechanicCertificateImage === "string") {
        providerProfile.mechanicCertificateImage = mechanicCertificateImage.trim() || null;
      }

      if (typeof cnicFrontImage === "string") {
        providerProfile.cnicFrontImage = cnicFrontImage.trim() || null;
        identityFieldsChanged = true;
      }

      if (typeof cnicBackImage === "string") {
        providerProfile.cnicBackImage = cnicBackImage.trim() || null;
        identityFieldsChanged = true;
      }

      if (typeof selfieImage === "string") {
        providerProfile.selfieImage = selfieImage.trim() || null;
        identityFieldsChanged = true;
      }

      if (typeof cnic === "string" && cnic.trim()) {
        providerProfile.cnic = normalizeCnic(cnic);
        identityFieldsChanged = true;
      }

      if (typeof city === "string" && city.trim()) {
        providerProfile.city = city.trim();
      }

      if (Array.isArray(serviceCodes) && serviceCodes.length > 0) {
        providerProfile.serviceCodes = [...new Set(serviceCodes)];
      }

      if (identityFieldsChanged) {
        providerProfile.cnicVerificationStatus = "rejected";
        providerProfile.cnicVerificationReason =
          "Identity documents changed. Re-verification is required.";
        providerProfile.cnicVerificationProvider = null;
        providerProfile.cnicVerifiedAt = null;
        providerProfile.cnicExtractedNumber = null;
        providerProfile.cnicFaceSimilarity = null;
        providerProfile.isAvailable = false;
      }

      await providerProfile.save();
    }

    return res.json(buildAuthResponse(user, providerProfile));
  } catch (error) {
    return res.status(500).json({ message: "Unable to update profile", error: getErrorMessage(error) });
  }
}
