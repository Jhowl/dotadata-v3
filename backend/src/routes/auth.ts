import { Router } from "express";
import { authController } from "@/controllers/auth.controller.js";
import { createRateLimiter } from "@/middleware/rate-limit.js";
import { wrap } from "@/utils/async.js";

const router = Router();

const authLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

router.get("/steam/login", authLimiter, wrap(authController.login));
router.get("/steam/callback", authLimiter, wrap(authController.callback));
router.get("/me", wrap(authController.me));
router.post("/logout", wrap(authController.logout));

export default router;
