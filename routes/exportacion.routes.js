import express from "express";

import {
  exportarExcel,
  exportarPdf,
  exportarCsvTodo,
  exportarCsvColeccion,
  exportarCsvOlap,
} from "../controllers/exportacion.controller.js";
import { obtenerEstadisticas } from "../controllers/estadisticas.controller.js";

const router = express.Router();

router.get("/estadisticas", obtenerEstadisticas);
router.get("/excel", exportarExcel);
router.get("/reporte/pdf", exportarPdf);
router.get("/csv", exportarCsvTodo);
// Antes que /csv/:coleccion, para que "olap" no se tome como colección.
router.get("/csv/olap", exportarCsvOlap);
router.get("/csv/:coleccion", exportarCsvColeccion);

export default router;
