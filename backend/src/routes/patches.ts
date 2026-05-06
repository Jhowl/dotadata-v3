import { Router } from "express";
import { patchesController } from "@/controllers/patches.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();

router.get("/", wrap(patchesController.list));
router.get("/:patch", wrap(patchesController.byPatch));
router.get("/:patch/matches", wrap(patchesController.matches));
router.get("/:patch/top-performers", wrap(patchesController.topPerformers));

export default router;
