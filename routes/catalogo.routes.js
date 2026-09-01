
import express from "express";

import {
  crearCatalogo,
  obtenerCatalogos,
  obtenerCatalogoPorId,
  actualizarCatalogo,
  eliminarCatalogo,
} from "../controllers/catalogo.controller.js";

const router = express.Router();

router.post("/catalogo", crearCatalogo);
router.get("/catalogo", obtenerCatalogos);
router.get("/catalogo/:id", obtenerCatalogoPorId);
router.put("/catalogo/:id", actualizarCatalogo);
router.delete("/catalogo/:id", eliminarCatalogo);

export default router;
