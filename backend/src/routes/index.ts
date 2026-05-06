import { Router } from "express";
import countsRouter from "./counts.js";
import leaguesRouter from "./leagues.js";
import teamsRouter from "./teams.js";
import patchesRouter from "./patches.js";
import { heroesRouter, playersRouter } from "./heroes.js";
import seasonsRouter from "./seasons.js";
import blogRouter from "./blog.js";
import commentsRouter from "./comments.js";
import authRouter from "./auth.js";
import contactRouter from "./contact.js";
import rssRouter from "./rss.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.use("/counts", countsRouter);
apiRouter.use("/leagues", leaguesRouter);
apiRouter.use("/teams", teamsRouter);
apiRouter.use("/patches", patchesRouter);
apiRouter.use("/heroes", heroesRouter);
apiRouter.use("/players", playersRouter);
apiRouter.use("/seasons", seasonsRouter);
apiRouter.use("/blog", blogRouter);
apiRouter.use("/comments", commentsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/rss.xml", rssRouter);
