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
