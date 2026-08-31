
import express from "express";

import { crearEmpleado } from "../controllers/empleado.controller.js";

const router = express.Router();

router.post("/empleados", crearEmpleado);

export default router;
