import { Router } from "express";
import { commentsController } from "@/controllers/comments.controller.js";
import { requireAuth } from "@/middleware/auth.js";
import { createRateLimiter } from "@/middleware/rate-limit.js";
import { wrap } from "@/utils/async.js";

const router = Router();

const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

router.get("/", wrap(commentsController.list));
router.post("/", writeLimiter, requireAuth, wrap(commentsController.create));
router.delete("/:id", writeLimiter, requireAuth, wrap(commentsController.remove));

export default router;
