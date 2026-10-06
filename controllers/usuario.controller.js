import bcrypt from "bcryptjs";
import db from "../firebase.js";
import { filtrarSnapshot, obtenerTerminoBusqueda } from "../utils/busqueda.js";

const usuariosRef = db.collection("usuarios");
const clientesRef = db.collection("clientes");
const empleadosRef = db.collection("empleados");

const SALT_ROUNDS = 10;
const ROLES_VALIDOS = ["cliente", "empleado", "administrador"];

const obtenerRefPerfil = (rol) => (rol === "cliente" ? clientesRef : empleadosRef);

const existePerfil = async (rol, perfil_id) => {
  const doc = await obtenerRefPerfil(rol).doc(perfil_id).get();
  return doc.exists;
};

const sinContrasena = ({ contrasena, ...resto }) => resto;

export const crearUsuario = async (req, res) => {
  try {
    const { telefono, contrasena, rol, perfil_id } = req.body;

    if (!telefono || !contrasena || !rol || !perfil_id) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: telefono, contrasena, rol, perfil_id.",
      });
    }

    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({
        mensaje: `rol debe ser uno de: ${ROLES_VALIDOS.join(", ")}.`,
      });
    }

    if (!(await existePerfil(rol, perfil_id))) {
      return res.status(400).json({
        mensaje: `No existe un ${rol} con id "${perfil_id}".`,
      });
    }

    const yaExiste = await usuariosRef.where("telefono", "==", telefono).limit(1).get();
    if (!yaExiste.empty) {
      return res.status(400).json({ mensaje: `Ya existe un usuario con el teléfono "${telefono}".` });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const nuevoUsuario = {
      telefono,
      contrasena: contrasenaHash,
      rol,
      perfil_id,
      fecha_registro: new Date(),
    };

    const docRef = await usuariosRef.add(nuevoUsuario);

    res.status(201).json({
      mensaje: "Usuario creado correctamente.",
      usuario: { id: docRef.id, ...sinContrasena(nuevoUsuario) },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear el usuario.", error: error.message });
  }
};

export const obtenerUsuarios = async (req, res) => {
  try {
    const snapshot = await usuariosRef.get();
    const usuarios = snapshot.docs.map((doc) => ({ id: doc.id, ...sinContrasena(doc.data()) }));
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los usuarios.", error: error.message });
  }
};

export const buscarUsuarios = async (req, res) => {
  try {
    const termino = obtenerTerminoBusqueda(req.query.q);
    if (!termino) {
      return res.status(400).json({ mensaje: "Debes enviar un término de búsqueda (parámetro q)." });
    }

    const snapshot = await usuariosRef.get();
    res.status(200).json(filtrarSnapshot(snapshot, termino, sinContrasena));
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    res.status(500).json({ mensaje: "Error al buscar los usuarios.", error: error.message });
  }
};

export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await usuariosRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...sinContrasena(doc.data()) });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el usuario.", error: error.message });
  }
};

export const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = usuariosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const usuarioActual = doc.data();
    const { telefono, contrasena, rol, perfil_id } = req.body;
    const cambios = {};

    const rolEfectivo = rol !== undefined ? rol : usuarioActual.rol;
    if (rol !== undefined) {
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({
          mensaje: `rol debe ser uno de: ${ROLES_VALIDOS.join(", ")}.`,
        });
      }
      cambios.rol = rol;
    }

    if (rol !== undefined || perfil_id !== undefined) {
      const perfilIdEfectivo = perfil_id !== undefined ? perfil_id : usuarioActual.perfil_id;
      if (!(await existePerfil(rolEfectivo, perfilIdEfectivo))) {
        return res.status(400).json({
          mensaje: `No existe un ${rolEfectivo} con id "${perfilIdEfectivo}".`,
        });
      }
      cambios.perfil_id = perfilIdEfectivo;
    }

    if (telefono !== undefined) {
      const yaExiste = await usuariosRef.where("telefono", "==", telefono).limit(1).get();
      if (!yaExiste.empty && yaExiste.docs[0].id !== id) {
        return res.status(400).json({ mensaje: `Ya existe un usuario con el teléfono "${telefono}".` });
      }
      cambios.telefono = telefono;
    }

    if (contrasena !== undefined) {
      cambios.contrasena = await bcrypt.hash(contrasena, SALT_ROUNDS);
    }

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Usuario actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el usuario.", error: error.message });
  }
};

export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = usuariosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Usuario eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el usuario.", error: error.message });
  }
};

export const iniciarSesion = async (req, res) => {
  try {
    const { telefono, contrasena } = req.body;

    if (!telefono || !contrasena) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: telefono, contrasena." });
    }

    const snapshot = await usuariosRef.where("telefono", "==", telefono).limit(1).get();
    if (snapshot.empty) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    const doc = snapshot.docs[0];
    const usuario = doc.data();

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    res.status(200).json({
      mensaje: "Inicio de sesión correcto.",
      usuario: { id: doc.id, ...sinContrasena(usuario) },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al iniciar sesión.", error: error.message });
  }
};
