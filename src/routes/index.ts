import { Router } from "express";
import { decoder } from "../controllers/decoder";

const router = Router();

router.get("/decode/:identifier", decoder);

export { router };
