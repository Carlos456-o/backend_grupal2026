import db from "../firebase.js";

const citasRef = db.collection("citas");
const clientesRef = db.collection("clientes");
const empleadosRef = db.collection("empleados");
const serviciosRef = db.collection("servicios");

const obtenerClienteConVehiculo = async (cliente_id, placa) => {
  const clienteDoc = await clientesRef.doc(cliente_id).get();
  if (!clienteDoc.exists) {
    return { error: `El cliente con id "${cliente_id}" no existe.` };
  }

  const vehiculos = clienteDoc.data().vehiculos || [];
  const vehiculo = vehiculos.find((v) => v.placa === placa);
  if (!vehiculo) {
    return { error: `El cliente no tiene registrado un vehículo con la placa "${placa}".` };
  }

  return { vehiculo };
};

const obtenerEmpleadoValido = async (empleado_id) => {
  const empleadoDoc = await empleadosRef.doc(empleado_id).get();
  if (!empleadoDoc.exists) {
    return { error: `El empleado con id "${empleado_id}" no existe.` };
  }
  return { empleadoDoc };
};

const obtenerServicioEmbebido = async (servicio_id) => {
  const servicioDoc = await serviciosRef.doc(servicio_id).get();
  if (!servicioDoc.exists) {
    return { error: `El servicio con id "${servicio_id}" no existe.` };
  }
  const { nombre, precio } = servicioDoc.data();
  return { servicio: { id: servicioDoc.id, nombre, precio } };
};

export const crearCita = async (req, res) => {
  try {
    const {
      cliente_id,
      empleado_id,
      servicio_id,
      placa,
      fecha,
      hora,
      estado,
      solicitud_especial,
    } = req.body;

    if (!cliente_id || !empleado_id || !servicio_id || !placa || !fecha || !hora) {
      return res.status(400).json({
        mensaje:
          "Faltan campos obligatorios: cliente_id, empleado_id, servicio_id, placa, fecha, hora.",
      });
    }

    const { vehiculo, error: errorCliente } = await obtenerClienteConVehiculo(cliente_id, placa);
    if (errorCliente) {
      return res.status(400).json({ mensaje: errorCliente });
    }

    const { error: errorEmpleado } = await obtenerEmpleadoValido(empleado_id);
    if (errorEmpleado) {
      return res.status(400).json({ mensaje: errorEmpleado });
    }

    const { servicio, error: errorServicio } = await obtenerServicioEmbebido(servicio_id);
    if (errorServicio) {
      return res.status(400).json({ mensaje: errorServicio });
    }

    const nuevaCita = {
      cliente_id,
      vehiculo,
      servicio,
      empleado_id,
      fecha: new Date(fecha),
      hora,
      estado: estado || "pendiente",
      solicitud_especial: solicitud_especial || "",
    };

    const docRef = await citasRef.add(nuevaCita);

    res.status(201).json({
      mensaje: "Cita creada correctamente.",
      cita: { id: docRef.id, ...nuevaCita },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear la cita.", error: error.message });
  }
};

export const obtenerCitas = async (req, res) => {
  try {
    const snapshot = await citasRef.get();
    const citas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(citas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener las citas.", error: error.message });
  }
};

export const obtenerCitaPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await citasRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener la cita.", error: error.message });
  }
};

export const actualizarCita = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = citasRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    const citaActual = doc.data();
    const {
      cliente_id,
      empleado_id,
      servicio_id,
      placa,
      fecha,
      hora,
      estado,
      solicitud_especial,
    } = req.body;

    const cambios = {};
    const clienteIdEfectivo = cliente_id !== undefined ? cliente_id : citaActual.cliente_id;

    if (cliente_id !== undefined || placa !== undefined) {
      const placaEfectiva = placa !== undefined ? placa : citaActual.vehiculo.placa;
      const { vehiculo, error: errorCliente } = await obtenerClienteConVehiculo(
        clienteIdEfectivo,
        placaEfectiva
      );
      if (errorCliente) {
        return res.status(400).json({ mensaje: errorCliente });
      }
      cambios.cliente_id = clienteIdEfectivo;
      cambios.vehiculo = vehiculo;
    }

    if (empleado_id !== undefined) {
      const { error: errorEmpleado } = await obtenerEmpleadoValido(empleado_id);
      if (errorEmpleado) {
        return res.status(400).json({ mensaje: errorEmpleado });
      }
      cambios.empleado_id = empleado_id;
    }

    if (servicio_id !== undefined) {
      const { servicio, error: errorServicio } = await obtenerServicioEmbebido(servicio_id);
      if (errorServicio) {
        return res.status(400).json({ mensaje: errorServicio });
      }
      cambios.servicio = servicio;
    }

    if (fecha !== undefined) cambios.fecha = new Date(fecha);
    if (hora !== undefined) cambios.hora = hora;
    if (estado !== undefined) cambios.estado = estado;
    if (solicitud_especial !== undefined) cambios.solicitud_especial = solicitud_especial;

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Cita actualizada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar la cita.", error: error.message });
  }
};

export const eliminarCita = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = citasRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Cita eliminada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar la cita.", error: error.message });
  }
};
