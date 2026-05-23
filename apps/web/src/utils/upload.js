import api from "../api";

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await api.post("/uploads/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data.fileUrl;
}
