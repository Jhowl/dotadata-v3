import { Router } from "express";
import { teamsController } from "@/controllers/teams.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();

router.get("/", wrap(teamsController.list));
router.get("/summaries", wrap(teamsController.summaries));

router.get("/:slug", wrap(teamsController.bySlug));
router.get("/:slug/summary", wrap(teamsController.summary));
router.get("/:slug/matches", wrap(teamsController.matches));
router.get("/:slug/handicap", wrap(teamsController.handicap));
router.get("/:slug/pickban", wrap(teamsController.pickBan));
router.get("/:slug/top-performers", wrap(teamsController.topPerformers));

export default router;
