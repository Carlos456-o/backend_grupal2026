
import express from "express";

import {
  crearServicio,
  obtenerServicios,
  buscarServicios,
  obtenerServicioPorId,
  actualizarServicio,
  eliminarServicio,
} from "../controllers/servicio.controller.js";

const router = express.Router();

router.post("/servicios", crearServicio);
router.get("/servicios", obtenerServicios);
router.get("/servicios/buscar", buscarServicios);
router.get("/servicios/:id", obtenerServicioPorId);
router.put("/servicios/:id", actualizarServicio);
router.delete("/servicios/:id", eliminarServicio);

export default router;
