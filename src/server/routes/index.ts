import { Router, type IRouter } from "express";
import healthRouter from "./health";
import crochetRouter from "./crochet";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(crochetRouter);
router.use(storageRouter);

export default router;
