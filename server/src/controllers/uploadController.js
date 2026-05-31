import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

async function removeLocalFile(path) {
  try {
    await fs.unlink(path);
  } catch (_error) {
    // Best-effort cleanup only.
  }
}

export async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  if (hasCloudinaryConfig()) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "roadside-assistance",
        resource_type: "image",
      });

      await removeLocalFile(req.file.path);

      return res.status(201).json({
        message: "Upload successful",
        fileUrl: uploadResult.secure_url,
        filename: uploadResult.public_id,
        provider: "cloudinary",
      });
    } catch (error) {
      await removeLocalFile(req.file.path);
      return res.status(500).json({
        message: "Cloudinary upload failed",
        error: error.message,
      });
    }
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  return res.status(201).json({
    message: "Upload successful",
    fileUrl,
    filename: req.file.filename,
  });
}
