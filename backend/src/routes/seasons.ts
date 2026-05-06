import { Router } from "express";
import { seasonsController } from "@/controllers/seasons.controller.js";
import { wrap } from "@/utils/async.js";

const router = Router();

router.get("/:year", wrap(seasonsController.byYear));
router.get("/:year/matches", wrap(seasonsController.matches));
router.get("/:year/export.csv", wrap(seasonsController.exportCsv));

export default router;
