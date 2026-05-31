import { API_URL } from "./config";

export async function uploadImageFromUri(uri) {
  const filename = uri.split("/").pop() || `image-${Date.now()}.jpg`;
  const extension = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "jpg";
  const formData = new FormData();

  formData.append("image", {
    uri,
    name: filename,
    type: `image/${extension === "jpg" ? "jpeg" : extension}`,
  });

  const response = await fetch(`${API_URL}/uploads/image`, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || "Image upload failed");
  }

  if (!payload?.fileUrl) {
    throw new Error("Upload completed but no file URL was returned");
  }

  return payload.fileUrl;
}
