import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import crochetRouter from "./crochet.js";
import contactRouter from "./contact.js";
import storageRouter from "./storage.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(crochetRouter);
router.use(contactRouter);
router.use(storageRouter);

export default router;
