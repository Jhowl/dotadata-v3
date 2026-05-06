import { Router } from "express";
import { leaguesController } from "@/controllers/leagues.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();

router.get("/", wrap(leaguesController.list));
router.get("/summaries", wrap(leaguesController.summaries));
router.get("/last-winners", wrap(leaguesController.lastWinners));

router.get("/:slug", wrap(leaguesController.bySlug));
router.get("/:slug/summary", wrap(leaguesController.summary));
router.get("/:slug/matches", wrap(leaguesController.matches));
router.get("/:slug/champion", wrap(leaguesController.champion));
router.get("/:slug/participation", wrap(leaguesController.participation));
router.get("/:slug/pickban", wrap(leaguesController.pickBan));
router.get("/:slug/pickban/analysis", wrap(leaguesController.pickBanAnalysis));
router.get("/:slug/top-performers", wrap(leaguesController.topPerformers));
router.get("/:slug/export.csv", wrap(leaguesController.exportCsv));

export default router;
