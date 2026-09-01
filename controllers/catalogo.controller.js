import db from "../firebase.js";

const catalogoRef = db.collection("catalogo");
const serviciosRef = db.collection("servicios");

const existeServicioPorNombre = async (nombreServicio) => {
  const snapshot = await serviciosRef.where("nombre", "==", nombreServicio).limit(1).get();
  return !snapshot.empty;
};

export const crearCatalogo = async (req, res) => {
  try {
    const { nombre, descripcion, servicio } = req.body;

    if (!nombre || !descripcion || !servicio) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: nombre, descripcion, servicio.",
      });
    }

    const servicioExiste = await existeServicioPorNombre(servicio);
    if (!servicioExiste) {
      return res.status(400).json({
        mensaje: `El servicio "${servicio}" no existe en la colección servicios.`,
      });
    }

    const nuevoCatalogo = { nombre, descripcion, servicio };

    const docRef = await catalogoRef.add(nuevoCatalogo);

    res.status(201).json({
      mensaje: "Catálogo creado correctamente.",
      catalogo: { id: docRef.id, ...nuevoCatalogo },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear el catálogo.", error: error.message });
  }
};

export const obtenerCatalogos = async (req, res) => {
  try {
    const snapshot = await catalogoRef.get();
    const catalogos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(catalogos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los catálogos.", error: error.message });
  }
};

export const obtenerCatalogoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await catalogoRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Catálogo no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el catálogo.", error: error.message });
  }
};

export const actualizarCatalogo = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = catalogoRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Catálogo no encontrado." });
    }

    const { nombre, descripcion, servicio } = req.body;
    const cambios = {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (descripcion !== undefined) cambios.descripcion = descripcion;

    if (servicio !== undefined) {
      const servicioExiste = await existeServicioPorNombre(servicio);
      if (!servicioExiste) {
        return res.status(400).json({
          mensaje: `El servicio "${servicio}" no existe en la colección servicios.`,
        });
      }
      cambios.servicio = servicio;
    }

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Catálogo actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el catálogo.", error: error.message });
  }
};

export const eliminarCatalogo = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = catalogoRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Catálogo no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Catálogo eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el catálogo.", error: error.message });
  }
};
