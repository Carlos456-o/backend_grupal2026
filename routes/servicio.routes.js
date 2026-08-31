
import express from "express";

import {
  crearServicio,
  obtenerServicios,
  obtenerServicioPorId,
  actualizarServicio,
  eliminarServicio,
} from "../controllers/servicio.controller.js";

const router = express.Router();

router.post("/servicios", crearServicio);

export default router;
