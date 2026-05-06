import { Router } from "express";
import { heroesController, playersController } from "@/controllers/heroes.controller.js";
import { wrap } from "@/utils/async.js";

export const heroesRouter = Router();
heroesRouter.get("/", wrap(heroesController.list));

export const playersRouter = Router();
playersRouter.get("/", wrap(playersController.byIds));
