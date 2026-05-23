export async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  return res.status(201).json({
    message: "Upload successful",
    fileUrl,
    filename: req.file.filename,
  });
}
