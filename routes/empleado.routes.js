
import express from "express";

import {
  crearEmpleado,
  obtenerEmpleados,
  obtenerEmpleadoPorId,
  actualizarEmpleado,
  eliminarEmpleado,
} from "../controllers/empleado.controller.js";

const router = express.Router();

router.post("/empleados", crearEmpleado);
router.get("/empleados", obtenerEmpleados);
router.get("/empleados/:id", obtenerEmpleadoPorId);
router.put("/empleados/:id", actualizarEmpleado);
router.delete("/empleados/:id", eliminarEmpleado);

export default router;
