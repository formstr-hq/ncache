import { Router } from "express";
import { decoder } from "../controllers/decoder";
import { preview, openEvent } from "../controllers/preview";

const router = Router();

router.get("/decode/:identifier", decoder);

router.get("/preview/:identifier", preview);

// Redirect into the live pollerama app (POLLERAMA_URL).
router.get("/open/:identifier", openEvent);

export { router };
