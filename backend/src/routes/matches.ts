import { Router } from "express";
import { matchesController } from "@/controllers/matches.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();
router.get("/", wrap(matchesController.query));
export default router;
