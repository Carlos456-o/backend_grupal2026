import express from "express";

import {
  crearServicioVendido,
  obtenerServiciosVendidos,
  obtenerServicioVendidoPorId,
  actualizarServicioVendido,
  eliminarServicioVendido,
} from "../controllers/servicioVendido.controller.js";

const router = express.Router();

router.post("/servicios-vendidos", crearServicioVendido);
router.get("/servicios-vendidos", obtenerServiciosVendidos);
router.get("/servicios-vendidos/:id", obtenerServicioVendidoPorId);
router.put("/servicios-vendidos/:id", actualizarServicioVendido);
router.delete("/servicios-vendidos/:id", eliminarServicioVendido);

export default router;
