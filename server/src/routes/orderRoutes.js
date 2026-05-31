import { Router } from "express";
import {
  acceptOrder,
  completeOrder,
  confirmFuelDelivered,
  createOrder,
  customerConfirmPayment,
  getMyActiveOrder,
  getOrderHistory,
  getOrderDetails,
  listOpenOrders,
  markArrived,
  markFuelDelivered,
  providerConfirmPayment,
  raiseTowingSos,
  respondToExtraWorkRequest,
  startOrderProgress,
  submitExtraWorkRequest,
  updateProviderLocation,
} from "../controllers/orderController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/mine/active", requireAuth, getMyActiveOrder);
router.get("/history", requireAuth, getOrderHistory);
router.get("/open", requireAuth, requireRole("provider"), listOpenOrders);
router.get("/:id", requireAuth, getOrderDetails);

router.post("/", requireAuth, requireRole("user"), createOrder);
router.post("/:id/accept", requireAuth, requireRole("provider"), acceptOrder);
router.post("/:id/arrive", requireAuth, requireRole("provider"), markArrived);
router.post("/:id/start", requireAuth, requireRole("provider"), startOrderProgress);
router.post("/:id/extra-work", requireAuth, requireRole("provider"), submitExtraWorkRequest);
router.post(
  "/:id/extra-work/:requestId/respond",
  requireAuth,
  requireRole("user"),
  respondToExtraWorkRequest
);
router.post("/:id/fuel-delivered", requireAuth, requireRole("provider"), markFuelDelivered);
router.post("/:id/fuel-confirm", requireAuth, requireRole("user"), confirmFuelDelivered);
router.post("/:id/complete", requireAuth, requireRole("provider"), completeOrder);
router.post("/:id/payment/customer-confirm", requireAuth, requireRole("user"), customerConfirmPayment);
router.post("/:id/payment/provider-confirm", requireAuth, requireRole("provider"), providerConfirmPayment);
router.post("/:id/sos", requireAuth, requireRole("user"), raiseTowingSos);
router.patch("/provider/location", requireAuth, requireRole("provider"), updateProviderLocation);

export default router;
