import { Router } from "express";
import { rssController } from "@/controllers/rss.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();
router.get("/", wrap(rssController.feed));
export default router;
