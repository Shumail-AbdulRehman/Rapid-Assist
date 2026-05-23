import { Router } from "express";
import {
  acceptOffer,
  createOffer,
  createRequest,
  getNearbyRequests,
  getRequestDetails,
  updateProviderLocation,
} from "../controllers/requestController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", requireAuth, requireRole("user"), createRequest);
router.get("/nearby", requireAuth, requireRole("provider"), getNearbyRequests);
router.get("/:id", requireAuth, getRequestDetails);
router.post("/offers", requireAuth, requireRole("provider"), createOffer);
router.post("/offers/:offerId/accept", requireAuth, requireRole("user"), acceptOffer);
router.patch("/provider/location", requireAuth, requireRole("provider"), updateProviderLocation);

export default router;
