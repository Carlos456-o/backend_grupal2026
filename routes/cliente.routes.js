
import express from "express";

import {
  crearCliente,
  obtenerClientes,
  obtenerClientePorId,
  actualizarCliente,
  eliminarCliente,
  agregarVehiculo,
  eliminarVehiculo,
} from "../controllers/cliente.controller.js";

const router = express.Router();

router.post("/clientes", crearCliente);
router.get("/clientes", obtenerClientes);
router.get("/clientes/:id", obtenerClientePorId);
router.put("/clientes/:id", actualizarCliente);
router.delete("/clientes/:id", eliminarCliente);

router.post("/clientes/:id/vehiculos", agregarVehiculo);
router.delete("/clientes/:id/vehiculos/:placa", eliminarVehiculo);

export default router;
