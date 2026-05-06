import { Router } from "express";
import { countsController } from "@/controllers/counts.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();
router.get("/", wrap(countsController.get));
export default router;
