import ExcelJS from "exceljs";
import db from "../firebase.js";

const clientesRef = db.collection("clientes");
const citasRef = db.collection("citas");
const empleadosRef = db.collection("empleados");

// Firestore devuelve Timestamp; ExcelJS necesita Date
const aFecha = (valor) => (valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null);

const darEstiloEncabezado = (hoja) => {
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  encabezado.alignment = { vertical: "middle", horizontal: "center" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
};

export const exportarExcel = async (req, res) => {
  try {
    const [clientesSnap, citasSnap, empleadosSnap] = await Promise.all([
      clientesRef.get(),
      citasRef.get(),
      empleadosRef.get(),
    ]);

    const clientes = new Map(clientesSnap.docs.map((doc) => [doc.id, doc.data()]));
    const empleados = new Map(empleadosSnap.docs.map((doc) => [doc.id, doc.data()]));

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    // Hoja de clientes
    const hojaClientes = workbook.addWorksheet("Clientes");
    hojaClientes.columns = [
      { header: "ID", key: "id", width: 24 },
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Teléfono", key: "telefono", width: 16 },
      { header: "Email", key: "email", width: 30 },
      { header: "Vehículos", key: "vehiculos", width: 40 },
      { header: "Fecha de registro", key: "fecha_registro", width: 20, style: { numFmt: "dd/mm/yyyy" } },
    ];

    clientesSnap.docs.forEach((doc) => {
      const c = doc.data();
      hojaClientes.addRow({
        id: doc.id,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email,
        vehiculos: (c.vehiculos || []).map((v) => `${v.placa} (${v.modelo})`).join(", "),
        fecha_registro: aFecha(c.fecha_registro),
      });
    });
    darEstiloEncabezado(hojaClientes);

    // Hoja de citas
    const hojaCitas = workbook.addWorksheet("Citas");
    hojaCitas.columns = [
      { header: "ID", key: "id", width: 24 },
      { header: "Fecha", key: "fecha", width: 14, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Hora", key: "hora", width: 10 },
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Teléfono cliente", key: "telefono", width: 16 },
      { header: "Placa", key: "placa", width: 12 },
      { header: "Modelo", key: "modelo", width: 20 },
      { header: "Servicio", key: "servicio", width: 26 },
      { header: "Precio", key: "precio", width: 12, style: { numFmt: "#,##0.00" } },
      { header: "Empleado", key: "empleado", width: 26 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Solicitud especial", key: "solicitud_especial", width: 36 },
    ];

    const citas = citasSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (aFecha(b.fecha) || 0) - (aFecha(a.fecha) || 0));

    citas.forEach((cita) => {
      const cliente = clientes.get(cita.cliente_id);
      const empleado = empleados.get(cita.empleado_id);
      hojaCitas.addRow({
        id: cita.id,
        fecha: aFecha(cita.fecha),
        hora: cita.hora,
        cliente: cliente?.nombre || cita.cliente_id,
        telefono: cliente?.telefono || "",
        placa: cita.vehiculo?.placa,
        modelo: cita.vehiculo?.modelo,
        servicio: cita.servicio?.nombre,
        precio: cita.servicio?.precio,
        empleado: empleado?.nombre || cita.empleado_id || "Sin asignar",
        estado: cita.estado,
        solicitud_especial: cita.solicitud_especial,
      });
    });
    darEstiloEncabezado(hojaCitas);

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="citas_y_clientes_${fecha}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error al exportar Excel:", error);
    res.status(500).json({ mensaje: "Error al generar el Excel.", error: error.message });
  }
};
