import api from "./api";

export async function uploadImageFromUri(uri) {
  const filename = uri.split("/").pop() || `image-${Date.now()}.jpg`;
  const extension = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "jpg";
  const formData = new FormData();

  formData.append("image", {
    uri,
    name: filename,
    type: `image/${extension === "jpg" ? "jpeg" : extension}`,
  });

  try {
    const response = await api.post("/uploads/image", formData);

    return response.data.fileUrl;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Image upload timed out. Check that the server is running and reachable from your phone.");
    }

    throw error;
  }
}
