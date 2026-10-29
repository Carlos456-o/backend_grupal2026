import express from "express";

import {
  exportarExcel,
  exportarPdf,
  exportarCsvTodo,
  exportarCsvColeccion,
} from "../controllers/exportacion.controller.js";
import { obtenerEstadisticas } from "../controllers/estadisticas.controller.js";

const router = express.Router();

router.get("/estadisticas", obtenerEstadisticas);
router.get("/excel", exportarExcel);
router.get("/reporte/pdf", exportarPdf);
router.get("/csv", exportarCsvTodo);
router.get("/csv/:coleccion", exportarCsvColeccion);

export default router;
