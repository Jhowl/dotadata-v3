import { Router } from "express";
import { contactController } from "@/controllers/contact.controller.js";
import { createRateLimiter } from "@/middleware/rate-limit.js";
import { wrap } from "@/utils/async.js";

const router = Router();

const ipLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5 });
const emailLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 3,
  keyGenerator: (req) => `email:${(req.body?.email ?? "anon").toString().toLowerCase()}`,
});

router.post("/", ipLimiter, emailLimiter, wrap(contactController.submit));

export default router;
