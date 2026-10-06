import db from "../firebase.js";

const serviciosVendidosRef = db.collection("servicio_vendidos");
const citasRef = db.collection("citas");

const ESTADO_TERMINADO = "terminado";

// Solo se puede dejar comentario si la cita existe y su estado es "terminado"
const obtenerCitaTerminada = async (cita_id) => {
  const citaDoc = await citasRef.doc(cita_id).get();
  if (!citaDoc.exists) {
    return { error: `La cita con id "${cita_id}" no existe.`, status: 404 };
  }

  const { estado } = citaDoc.data();
  if (String(estado).toLowerCase() !== ESTADO_TERMINADO) {
    return {
      error: `Solo se puede valorar una cita con estado "${ESTADO_TERMINADO}". Estado actual: "${estado}".`,
      status: 400,
    };
  }

  return { estado };
};

export const crearServicioVendido = async (req, res) => {
  try {
    const { cita_id, valoracion, comentario } = req.body;

    if (!cita_id || valoracion === undefined) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: cita_id, valoracion.",
      });
    }

    const { estado, error, status } = await obtenerCitaTerminada(cita_id);
    if (error) {
      return res.status(status).json({ mensaje: error });
    }

    // Un solo comentario por cita
    const existente = await serviciosVendidosRef.where("cita_id", "==", cita_id).limit(1).get();
    if (!existente.empty) {
      return res.status(400).json({ mensaje: "Esta cita ya tiene un comentario registrado." });
    }

    const nuevoServicioVendido = {
      cita_id,
      estado,
      valoracion: String(valoracion),
      comentario: comentario || "",
      fecha_registro: new Date(),
    };

    const docRef = await serviciosVendidosRef.add(nuevoServicioVendido);

    res.status(201).json({
      mensaje: "Comentario registrado correctamente.",
      servicio_vendido: { id: docRef.id, ...nuevoServicioVendido },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al registrar el comentario.", error: error.message });
  }
};

export const obtenerServiciosVendidos = async (req, res) => {
  try {
    const snapshot = await serviciosVendidosRef.get();
    const serviciosVendidos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(serviciosVendidos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los comentarios.", error: error.message });
  }
};

export const obtenerServicioVendidoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await serviciosVendidosRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Comentario no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el comentario.", error: error.message });
  }
};

export const actualizarServicioVendido = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = serviciosVendidosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Comentario no encontrado." });
    }

    const { valoracion, comentario } = req.body;
    const cambios = {};

    if (valoracion !== undefined) cambios.valoracion = String(valoracion);
    if (comentario !== undefined) cambios.comentario = comentario;

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Comentario actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el comentario.", error: error.message });
  }
};

export const eliminarServicioVendido = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = serviciosVendidosRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Comentario no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Comentario eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el comentario.", error: error.message });
  }
};
