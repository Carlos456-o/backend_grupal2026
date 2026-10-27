
import express from "express";

import {
  crearUsuario,
  generarUsuariosClientes,
  obtenerUsuarios,
  buscarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  iniciarSesion,
} from "../controllers/usuario.controller.js";

const router = express.Router();

router.post("/usuarios", crearUsuario);
router.post("/usuarios/generar-clientes", generarUsuariosClientes);
router.get("/usuarios", obtenerUsuarios);
router.get("/usuarios/buscar", buscarUsuarios);
router.get("/usuarios/:id", obtenerUsuarioPorId);
router.put("/usuarios/:id", actualizarUsuario);
router.delete("/usuarios/:id", eliminarUsuario);

router.post("/usuarios/login", iniciarSesion);

export default router;
