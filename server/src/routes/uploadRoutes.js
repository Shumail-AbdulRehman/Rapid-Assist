import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { uploadImage } from "../controllers/uploadController.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || ".jpg");
    const basename = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9-_]/g, "-");
    cb(null, `${Date.now()}-${basename}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image uploads are allowed"));
  },
});

router.post("/image", upload.single("image"), uploadImage);

export default router;
