import db from "../firebase.js";

const empleadosRef = db.collection("empleados");

export const crearEmpleado = async (req, res) => {
  try {
    const { nombre, telefono, rol } = req.body;

    if (!nombre || !telefono || !rol) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: nombre, telefono, rol.",
      });
    }

    const nuevoEmpleado = {
      nombre,
      telefono,
      rol,
    };

    const docRef = await empleadosRef.add(nuevoEmpleado);

    res.status(201).json({
      mensaje: "Empleado creado correctamente.",
      empleado: { id: docRef.id, ...nuevoEmpleado },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear el empleado.", error: error.message });
  }
};

export const obtenerEmpleados = async (req, res) => {
  try {
    const snapshot = await empleadosRef.get();
    const empleados = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(empleados);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los empleados.", error: error.message });
  }
};

export const obtenerEmpleadoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await empleadosRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Empleado no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el empleado.", error: error.message });
  }
};

export const actualizarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = empleadosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Empleado no encontrado." });
    }

    const { nombre, telefono, rol } = req.body;
    const cambios = {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (telefono !== undefined) cambios.telefono = telefono;
    if (rol !== undefined) cambios.rol = rol;

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Empleado actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el empleado.", error: error.message });
  }
};

export const eliminarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = empleadosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Empleado no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Empleado eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el empleado.", error: error.message });
  }
};
