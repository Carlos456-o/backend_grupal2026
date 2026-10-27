import express from "express";

import { exportarExcel } from "../controllers/exportacion.controller.js";

const router = express.Router();

router.get("/excel", exportarExcel);

export default router;
