import db, { auth } from "../firebase.js";
import { filtrarSnapshot, obtenerTerminoBusqueda } from "../utils/busqueda.js";

// Las cuentas (correo y contraseña) viven en Firebase Authentication.
// En Firestore, usuarios/{uid} guarda el perfil: telefono, correo, rol y perfil_id.
const usuariosRef = db.collection("usuarios");
const clientesRef = db.collection("clientes");
const empleadosRef = db.collection("empleados");

const ROLES_VALIDOS = ["cliente", "empleado", "administrador"];
const DOMINIO_SIN_CORREO = "sin-correo.divinonino.app";

const ERRORES_AUTH = {
  "auth/email-already-exists": "Ya existe una cuenta con ese correo.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/invalid-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/user-not-found": "La cuenta no existe en Firebase Authentication.",
};

const obtenerRefPerfil = (rol) => (rol === "cliente" ? clientesRef : empleadosRef);

const obtenerPerfil = async (rol, perfil_id) => {
  const doc = await obtenerRefPerfil(rol).doc(perfil_id).get();
  return doc.exists ? doc.data() : null;
};

// Correo de la cuenta: el enviado, el del perfil o uno generado a partir del teléfono
const resolverCorreo = (correo, perfil, telefono) =>
  (correo || perfil?.email || perfil?.correo || `${telefono}@${DOMINIO_SIN_CORREO}`).trim().toLowerCase();

const responderErrorAuth = (res, error, mensaje) => {
  if (ERRORES_AUTH[error.code]) {
    return res.status(400).json({ mensaje: ERRORES_AUTH[error.code] });
  }
  return res.status(500).json({ mensaje, error: error.message });
};

// Crea la cuenta en Firebase Authentication y su documento usuarios/{uid}
const registrarCuenta = async ({ telefono, correo, contrasena, rol, perfil_id }) => {
  const cuenta = await auth.createUser({ email: correo, password: String(contrasena) });

  const nuevoUsuario = {
    telefono,
    correo,
    rol,
    perfil_id,
    fecha_registro: new Date(),
  };

  try {
    await usuariosRef.doc(cuenta.uid).set(nuevoUsuario);
  } catch (error) {
    // Sin perfil la cuenta queda huérfana: se revierte
    await auth.deleteUser(cuenta.uid);
    throw error;
  }

  return { id: cuenta.uid, ...nuevoUsuario };
};

export const crearUsuario = async (req, res) => {
  try {
    const { telefono, correo, contrasena, rol, perfil_id } = req.body;

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

    const perfil = await obtenerPerfil(rol, perfil_id);
    if (!perfil) {
      return res.status(400).json({
        mensaje: `No existe un ${rol} con id "${perfil_id}".`,
      });
    }

    const yaExiste = await usuariosRef.where("telefono", "==", telefono).limit(1).get();
    if (!yaExiste.empty) {
      return res.status(400).json({ mensaje: `Ya existe un usuario con el teléfono "${telefono}".` });
    }

    const usuario = await registrarCuenta({
      telefono,
      correo: resolverCorreo(correo, perfil, telefono),
      contrasena,
      rol,
      perfil_id,
    });

    res.status(201).json({ mensaje: "Usuario creado correctamente.", usuario });
  } catch (error) {
    responderErrorAuth(res, error, "Error al crear el usuario.");
  }
};

// Crea una cuenta (rol "cliente") por cada cliente que aún no tenga una.
// Usa el correo del cliente y su teléfono como contraseña inicial.
export const generarUsuariosClientes = async (req, res) => {
  try {
    const [clientesSnap, usuariosSnap] = await Promise.all([clientesRef.get(), usuariosRef.get()]);

    const telefonosUsados = new Set(usuariosSnap.docs.map((doc) => doc.data().telefono));
    const perfilesConUsuario = new Set(
      usuariosSnap.docs.filter((doc) => doc.data().rol === "cliente").map((doc) => doc.data().perfil_id)
    );

    const creados = [];
    const omitidos = [];

    for (const doc of clientesSnap.docs) {
      const cliente = doc.data();
      const telefono = cliente.telefono;

      if (!telefono) {
        omitidos.push({ cliente_id: doc.id, motivo: "El cliente no tiene teléfono." });
        continue;
      }
      if (perfilesConUsuario.has(doc.id)) {
        omitidos.push({ cliente_id: doc.id, motivo: "El cliente ya tiene un usuario." });
        continue;
      }
      if (telefonosUsados.has(telefono)) {
        omitidos.push({ cliente_id: doc.id, motivo: `Ya existe un usuario con el teléfono "${telefono}".` });
        continue;
      }

      try {
        const usuario = await registrarCuenta({
          telefono,
          correo: resolverCorreo(null, cliente, telefono),
          contrasena: telefono,
          rol: "cliente",
          perfil_id: doc.id,
        });
        telefonosUsados.add(telefono);
        creados.push(usuario);
      } catch (error) {
        omitidos.push({ cliente_id: doc.id, motivo: ERRORES_AUTH[error.code] || error.message });
      }
    }

    res.status(201).json({
      mensaje: `Se crearon ${creados.length} usuarios para clientes.`,
      creados,
      omitidos,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al generar los usuarios de clientes.", error: error.message });
  }
};

export const obtenerUsuarios = async (req, res) => {
  try {
    const snapshot = await usuariosRef.get();
    const usuarios = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    res.status(200).json(filtrarSnapshot(snapshot, termino));
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

    res.status(200).json({ id: doc.id, ...doc.data() });
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
    const { telefono, correo, contrasena, rol, perfil_id } = req.body;
    const cambios = {};
    const cambiosAuth = {};

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
      if (!(await obtenerPerfil(rolEfectivo, perfilIdEfectivo))) {
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

    if (correo !== undefined) {
      cambios.correo = correo.trim().toLowerCase();
      cambiosAuth.email = cambios.correo;
    }

    if (contrasena !== undefined) {
      cambiosAuth.password = String(contrasena);
    }

    // Primero Auth: si rechaza el correo o la contraseña, Firestore queda sin tocar
    if (Object.keys(cambiosAuth).length) {
      await auth.updateUser(id, cambiosAuth);
    }

    if (Object.keys(cambios).length) {
      await docRef.update(cambios);
    }

    res.status(200).json({ mensaje: "Usuario actualizado correctamente." });
  } catch (error) {
    responderErrorAuth(res, error, "Error al actualizar el usuario.");
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

    try {
      await auth.deleteUser(id);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Usuario eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el usuario.", error: error.message });
  }
};

// El inicio de sesión lo hace la app con Firebase Authentication (correo y contraseña).
// Esta ruta recibe el ID token de esa sesión (Authorization: Bearer <token>),
// lo verifica y devuelve el perfil del usuario.
export const iniciarSesion = async (req, res) => {
  try {
    const [tipo, token] = (req.headers.authorization || "").split(" ");

    if (tipo !== "Bearer" || !token) {
      return res.status(401).json({
        mensaje: "Falta el token de Firebase en el header Authorization: Bearer <token>.",
      });
    }

    let uid;
    try {
      ({ uid } = await auth.verifyIdToken(token));
    } catch {
      return res.status(401).json({ mensaje: "Token inválido o expirado." });
    }

    const doc = await usuariosRef.doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ mensaje: "La cuenta no tiene un perfil en usuarios." });
    }

    res.status(200).json({
      mensaje: "Inicio de sesión correcto.",
      usuario: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al iniciar sesión.", error: error.message });
  }
};
