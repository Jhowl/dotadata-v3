import { Router } from "express";
import { blogController } from "@/controllers/blog.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();

router.get("/", wrap(blogController.list));
router.get("/:slug", wrap(blogController.bySlug));
router.post("/", wrap(blogController.upsert));

export default router;
