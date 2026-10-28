import db from "../firebase.js";

// Estadísticas del negocio a partir de las citas de Firestore.
// calcularEstadisticas() se escribe una sola vez y la usan:
//   - GET /estadisticas        (JSON para la pantalla del admin en la app)
//   - GET /excel               (hojas de resumen y la hoja de hechos para el cubo OLAP)
//   - GET /reporte/pdf         (reporte para imprimir)

const citasRef = db.collection("citas");
const clientesRef = db.collection("clientes");
const empleadosRef = db.collection("empleados");

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const NOMBRES_ESTADO = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_proceso: "En proceso",
  terminado: "Terminado",
  cancelada: "Cancelada",
};

// Las citas guardan la fecha como Timestamp a medianoche UTC: leemos el día en UTC.
const aFecha = (valor) => (valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null);
const redondear = (n) => Math.round(n * 100) / 100;

// "08:30" -> "Mañana", "13:00" -> "Tarde"
const franjaHoraria = (hora) => {
  const h = Number(String(hora).split(":")[0]);
  if (Number.isNaN(h)) return "Sin hora";
  return h < 12 ? "Mañana" : "Tarde";
};

// Suma una cita a un grupo: { citas, ingresos }
const sumar = (grupos, clave, ingreso) => {
  if (!grupos.has(clave)) grupos.set(clave, { citas: 0, ingresos: 0 });
  const g = grupos.get(clave);
  g.citas += 1;
  g.ingresos += ingreso;
};

const aLista = (grupos, nombreClave) =>
  [...grupos.entries()].map(([clave, g]) => ({ [nombreClave]: clave, citas: g.citas, ingresos: redondear(g.ingresos) }));

export const calcularEstadisticas = async () => {
  const [citasSnap, clientesSnap, empleadosSnap] = await Promise.all([
    citasRef.get(),
    clientesRef.get(),
    empleadosRef.get(),
  ]);
  const clientes = new Map(clientesSnap.docs.map((d) => [d.id, d.data()]));
  const empleados = new Map(empleadosSnap.docs.map((d) => [d.id, d.data()]));

  // ---- Tabla de hechos: una fila por cita, con sus dimensiones y medidas ----
  const hechos = citasSnap.docs.map((doc) => {
    const c = doc.data();
    const fecha = aFecha(c.fecha);
    const estado = String(c.estado || "pendiente").toLowerCase();
    const precioFinal = Number(c.servicio?.precio) || 0;
    const descuento = Number(c.descuento?.monto) || 0;
    return {
      cita_id: doc.id,
      fecha,
      anio: fecha ? fecha.getUTCFullYear() : null,
      mes_numero: fecha ? fecha.getUTCMonth() + 1 : null,
      mes: fecha ? MESES[fecha.getUTCMonth()] : "",
      anio_mes: fecha ? `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}` : "",
      dia_semana: fecha ? DIAS[fecha.getUTCDay()] : "",
      hora: c.hora || "",
      franja: franjaHoraria(c.hora),
      servicio: c.servicio?.nombre || "Sin servicio",
      cliente: clientes.get(c.cliente_id)?.nombre || "Cliente no encontrado",
      placa: c.vehiculo?.placa || "",
      vehiculo: c.vehiculo?.modelo || "Sin vehículo",
      empleado: empleados.get(c.empleado_id)?.nombre || "Sin asignar",
      estado: NOMBRES_ESTADO[estado] || estado,
      estado_clave: estado,
      promocion: c.descuento?.titulo || "Sin promoción",
      precio_original: precioFinal + descuento,
      descuento,
      precio_final: precioFinal,
      estrellas: c.calificacion?.estrellas ?? null,
      cantidad: 1,
    };
  });

  // ---- Medidas generales ----
  const terminadas = hechos.filter((h) => h.estado_clave === "terminado");
  const canceladas = hechos.filter((h) => h.estado_clave === "cancelada");
  const activas = hechos.filter((h) => ["pendiente", "confirmada", "en_proceso"].includes(h.estado_clave));
  const ingresos = terminadas.reduce((s, h) => s + h.precio_final, 0);
  const ingresosPorCobrar = activas.reduce((s, h) => s + h.precio_final, 0);
  const calificadas = hechos.filter((h) => h.estrellas);

  // ---- Agrupaciones (las cancelaciones no cuentan como demanda real) ----
  const validas = hechos.filter((h) => h.estado_clave !== "cancelada");
  const porServicio = new Map();
  const porMes = new Map();
  const porHora = new Map();
  const porDia = new Map();
  const porEmpleado = new Map();
  for (const h of validas) {
    const ingreso = h.estado_clave === "terminado" ? h.precio_final : 0;
    sumar(porServicio, h.servicio, ingreso);
    if (h.anio_mes) sumar(porMes, h.anio_mes, ingreso);
    if (h.hora) sumar(porHora, h.hora, ingreso);
    if (h.dia_semana) sumar(porDia, h.dia_semana, ingreso);
    sumar(porEmpleado, h.empleado, ingreso);
  }

  const porEstrellas = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  calificadas.forEach((h) => (porEstrellas[h.estrellas] = (porEstrellas[h.estrellas] || 0) + 1));

  const porEstado = {};
  hechos.forEach((h) => (porEstado[h.estado] = (porEstado[h.estado] || 0) + 1));

  return {
    generado: new Date().toISOString(),
    resumen: {
      totalCitas: hechos.length,
      terminadas: terminadas.length,
      activas: activas.length,
      canceladas: canceladas.length,
      tasaCancelacion: hechos.length ? redondear((canceladas.length / hechos.length) * 100) : 0,
      ingresos: redondear(ingresos),
      ingresosPorCobrar: redondear(ingresosPorCobrar),
      ticketPromedio: terminadas.length ? redondear(ingresos / terminadas.length) : 0,
      descuentosOtorgados: redondear(hechos.reduce((s, h) => s + (h.estado_clave === "cancelada" ? 0 : h.descuento), 0)),
      totalClientes: clientes.size,
      clientesConCitas: new Set(citasSnap.docs.map((d) => d.data().cliente_id)).size,
      calificacionPromedio: calificadas.length
        ? redondear(calificadas.reduce((s, h) => s + h.estrellas, 0) / calificadas.length)
        : null,
      totalCalificaciones: calificadas.length,
    },
    porEstado,
    porServicio: aLista(porServicio, "servicio").sort((a, b) => b.citas - a.citas),
    porMes: aLista(porMes, "mes").sort((a, b) => (a.mes > b.mes ? 1 : -1)),
    porHora: aLista(porHora, "hora").sort((a, b) => (a.hora > b.hora ? 1 : -1)),
    porDiaSemana: DIAS.map((dia) => ({ dia, citas: porDia.get(dia)?.citas || 0 })),
    porEmpleado: aLista(porEmpleado, "empleado").sort((a, b) => b.citas - a.citas),
    porEstrellas,
    hechos,
  };
};

// GET /estadisticas -> JSON (sin la tabla de hechos, que es solo para el Excel)
export const obtenerEstadisticas = async (req, res) => {
  try {
    const { hechos, ...estadisticas } = await calcularEstadisticas();
    res.status(200).json(estadisticas);
  } catch (error) {
    console.error("Error al calcular estadísticas:", error);
    res.status(500).json({ mensaje: "Error al calcular las estadísticas.", error: error.message });
  }
};
