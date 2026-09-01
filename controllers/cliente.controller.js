import db from "../firebase.js";

const clientesRef = db.collection("clientes");

const esVehiculoValido = (vehiculo) =>
  vehiculo && typeof vehiculo === "object" && typeof vehiculo.placa === "string" && typeof vehiculo.modelo === "string";

export const crearCliente = async (req, res) => {
  try {
    const { nombre, telefono, email, vehiculos } = req.body;

    if (!nombre || !telefono || !email) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: nombre, telefono, email.",
      });
    }

    if (vehiculos !== undefined && (!Array.isArray(vehiculos) || !vehiculos.every(esVehiculoValido))) {
      return res.status(400).json({
        mensaje: "vehiculos debe ser un arreglo de objetos con placa y modelo.",
      });
    }

    const nuevoCliente = {
      nombre,
      telefono,
      email,
      vehiculos: Array.isArray(vehiculos) ? vehiculos : [],
      fecha_registro: new Date(),
    };

    const docRef = await clientesRef.add(nuevoCliente);

    res.status(201).json({
      mensaje: "Cliente creado correctamente.",
      cliente: { id: docRef.id, ...nuevoCliente },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear el cliente.", error: error.message });
  }
};

export const obtenerClientes = async (req, res) => {
  try {
    const snapshot = await clientesRef.get();
    const clientes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(clientes);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los clientes.", error: error.message });
  }
};

export const obtenerClientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await clientesRef.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cliente no encontrado." });
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el cliente.", error: error.message });
  }
};

export const actualizarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = clientesRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cliente no encontrado." });
    }

    const { nombre, telefono, email, vehiculos } = req.body;
    const cambios = {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (telefono !== undefined) cambios.telefono = telefono;
    if (email !== undefined) cambios.email = email;

    if (vehiculos !== undefined) {
      if (!Array.isArray(vehiculos) || !vehiculos.every(esVehiculoValido)) {
        return res.status(400).json({
          mensaje: "vehiculos debe ser un arreglo de objetos con placa y modelo.",
        });
      }
      cambios.vehiculos = vehiculos;
    }

    await docRef.update(cambios);

    res.status(200).json({ mensaje: "Cliente actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar el cliente.", error: error.message });
  }
};

export const eliminarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = clientesRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cliente no encontrado." });
    }

    await docRef.delete();

    res.status(200).json({ mensaje: "Cliente eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el cliente.", error: error.message });
  }
};

export const agregarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = clientesRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cliente no encontrado." });
    }

    const { placa, modelo } = req.body;
    if (!esVehiculoValido({ placa, modelo })) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: placa, modelo." });
    }

    const vehiculosActuales = doc.data().vehiculos || [];
    const yaExiste = vehiculosActuales.some((v) => v.placa === placa);
    if (yaExiste) {
      return res.status(400).json({ mensaje: `Ya existe un vehículo con la placa "${placa}".` });
    }

    const vehiculos = [...vehiculosActuales, { placa, modelo }];
    await docRef.update({ vehiculos });

    res.status(201).json({ mensaje: "Vehículo agregado correctamente.", vehiculos });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al agregar el vehículo.", error: error.message });
  }
};

export const eliminarVehiculo = async (req, res) => {
  try {
    const { id, placa } = req.params;
    const docRef = clientesRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ mensaje: "Cliente no encontrado." });
    }

    const vehiculosActuales = doc.data().vehiculos || [];
    const vehiculos = vehiculosActuales.filter((v) => v.placa !== placa);

    if (vehiculos.length === vehiculosActuales.length) {
      return res.status(404).json({ mensaje: `No se encontró un vehículo con la placa "${placa}".` });
    }

    await docRef.update({ vehiculos });

    res.status(200).json({ mensaje: "Vehículo eliminado correctamente.", vehiculos });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar el vehículo.", error: error.message });
  }
};
