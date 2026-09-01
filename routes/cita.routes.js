
import express from "express";

import {
  crearCita,
  obtenerCitas,
  obtenerCitaPorId,
  actualizarCita,
  eliminarCita,
} from "../controllers/cita.controller.js";

const router = express.Router();

router.post("/citas", crearCita);
router.get("/citas", obtenerCitas);
router.get("/citas/:id", obtenerCitaPorId);
router.put("/citas/:id", actualizarCita);
router.delete("/citas/:id", eliminarCita);

export default router;
