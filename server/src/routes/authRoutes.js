import { Router } from "express";
import { getMe, login, register, updateMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);

export default router;
