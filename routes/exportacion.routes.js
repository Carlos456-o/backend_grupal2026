import express from "express";

import { exportarExcel, exportarPdf } from "../controllers/exportacion.controller.js";
import { obtenerEstadisticas } from "../controllers/estadisticas.controller.js";

const router = express.Router();

router.get("/estadisticas", obtenerEstadisticas);
router.get("/excel", exportarExcel);
router.get("/reporte/pdf", exportarPdf);

export default router;
