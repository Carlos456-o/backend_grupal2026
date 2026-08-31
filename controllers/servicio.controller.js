import db from "../firebase.js";

const serviciosRef = db.collection("servicios");

export const crearServicio = async (req, res) => {
  try {
    const { nombre, descripcion, precio, duracion_min, actividades_incluidas } = req.body;

    if (!nombre || !descripcion || precio === undefined || duracion_min === undefined) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: nombre, descripcion, precio, duracion_min.",
      });
    }

    const nuevoServicio = {
      nombre,
      descripcion,
      precio: Number(precio),
      duracion_min: Number(duracion_min),
      actividades_incluidas: Array.isArray(actividades_incluidas) ? actividades_incluidas : [],
    };

    const docRef = await serviciosRef.add(nuevoServicio);

    res.status(201).json({
      mensaje: "Servicio creado correctamente.",
      servicio: { id: docRef.id, ...nuevoServicio },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear el servicio.", error: error.message });
  }
};
export const obtenerServicios = async (req, res) => {
  try {
    const snapshot = await serviciosRef.get();
    const servicios = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(servicios);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los servicios.", error: error.message });
  }
};

export const obtenerServicioPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await serviciosRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Servicio no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el servicio.", error: error.message });
  }
};

export const actualizarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = serviciosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Servicio no encontrado." });
    }

    const { nombre, descripcion, precio, duracion_min, actividades_incluidas } = req.body;
    const cambios = {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (descripcion !== undefined) cambios.descripcion = descripcion;
    if (precio !== undefined) cambios.precio = Number(precio);
    if (duracion_min !== undefined) cambios.duracion_min = Number(duracion_min);
    if (actividades_incluidas !== undefined) cambios.actividades_incluidas = actividades_incluidas;

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Servicio actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el servicio.", error: error.message });
  }
};

export const eliminarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = serviciosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Servicio no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Servicio eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el servicio.", error: error.message });
  }
};

