// CSV de origen para el cubo OLAP en Pentaho (carpeta datos/ del proyecto).
// Una fila por cita con todas sus dimensiones y medidas, siguiendo las
// reglas del cubo de actas:
//   - separador ";", UTF-8 sin BOM, con cabecera
//   - fechas en dd/MM/yyyy y decimales con punto (2 decimales)
//   - CERO valores vacíos: textos faltantes -> "SIN ...", números -> 0
//   - medidas 1/0 para poder sumarlas en Memory group by
// No usa Firebase: recibe los datos ya leídos, así se puede probar sola.

const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];
const ESTADOS = {
  pendiente: "PENDIENTE",
  confirmada: "CONFIRMADA",
  en_proceso: "EN PROCESO",
  terminado: "TERMINADO",
  cancelada: "CANCELADA",
};

export const COLUMNAS_OLAP = [
  "Cod_Cita",
  "Fecha",
  "Anno",
  "Mes",
  "Mes_Nombre",
  "Dia",
  "Dia_Semana",
  "Hora",
  "Franja",
  "Cod_Cliente",
  "Cliente",
  "Placa",
  "Modelo_Vehiculo",
  "Cod_Servicio",
  "Servicio",
  "Duracion_Min",
  "Cod_Empleado",
  "Empleado",
  "Puesto",
  "Estado",
  "Promocion",
  "Tipo_Promocion",
  "Precio_Original",
  "Descuento",
  "Precio_Final",
  "Ingreso",
  "Estrellas",
  "Cantidad",
  "Terminada",
  "Cancelada",
  "Activa",
  "Con_Promocion",
  "Calificada",
];

const dos = (n) => String(n).padStart(2, "0");
const decimal = (n) => (Number(n) || 0).toFixed(2);

// Texto limpio: sin espacios sobrantes, sin ";" ni saltos de línea que rompan
// las columnas en Pentaho, y con un valor por defecto si viene vacío.
const texto = (valor, porDefecto) => {
  const limpio = String(valor ?? "").replace(/[;\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
  return limpio || porDefecto;
};

// Timestamp de Firestore (o Date) -> Date. Las citas se guardan a medianoche UTC.
const aFecha = (valor) => {
  const fecha = valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
};

const franja = (hora) => {
  const h = Number(String(hora).split(":")[0]);
  if (Number.isNaN(h)) return "SIN HORA";
  return h < 12 ? "MANANA" : "TARDE";
};

// cita: datos de Firestore con su id. Los mapas van de id -> datos.
// Devuelve null si la cita no tiene fecha válida (no se puede ubicar en el cubo).
export function filaOlap(cita, { clientes, empleados, servicios }) {
  const fecha = aFecha(cita.fecha);
  if (!fecha) return null;

  const estadoClave = String(cita.estado || "pendiente").toLowerCase();
  const cliente = clientes.get(cita.cliente_id);
  const empleado = cita.empleado_id ? empleados.get(cita.empleado_id) : null;
  const servicio = servicios.get(cita.servicio?.id);
  const precioFinal = Number(cita.servicio?.precio) || 0;
  const descuento = Number(cita.descuento?.monto) || 0;
  const estrellas = Number(cita.calificacion?.estrellas) || 0;
  const terminada = estadoClave === "terminado" ? 1 : 0;
  const cancelada = estadoClave === "cancelada" ? 1 : 0;

  return {
    Cod_Cita: cita.id,
    Fecha: `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`,
    Anno: fecha.getUTCFullYear(),
    Mes: fecha.getUTCMonth() + 1,
    Mes_Nombre: MESES[fecha.getUTCMonth()],
    Dia: fecha.getUTCDate(),
    Dia_Semana: DIAS[fecha.getUTCDay()],
    Hora: texto(cita.hora, "00:00"),
    Franja: franja(cita.hora),
    Cod_Cliente: texto(cita.cliente_id, "SIN CLIENTE"),
    Cliente: texto(cliente?.nombre, "CLIENTE NO ENCONTRADO").toUpperCase(),
    Placa: texto(cita.vehiculo?.placa, "SIN PLACA").toUpperCase(),
    Modelo_Vehiculo: texto(cita.vehiculo?.modelo, "SIN MODELO").toUpperCase(),
    Cod_Servicio: texto(cita.servicio?.id, "SIN SERVICIO"),
    Servicio: texto(cita.servicio?.nombre, "SIN SERVICIO").toUpperCase(),
    Duracion_Min: Number(servicio?.duracion_min) || 0,
    Cod_Empleado: texto(cita.empleado_id, "SIN ASIGNAR"),
    Empleado: texto(empleado?.nombre, "SIN ASIGNAR").toUpperCase(),
    Puesto: texto(empleado?.rol, "SIN ASIGNAR").toUpperCase(),
    Estado: ESTADOS[estadoClave] || texto(estadoClave, "PENDIENTE").toUpperCase(),
    Promocion: texto(cita.descuento?.titulo, "SIN PROMOCION").toUpperCase(),
    Tipo_Promocion: descuento > 0 ? "CON DESCUENTO" : "SIN DESCUENTO",
    Precio_Original: decimal(precioFinal + descuento),
    Descuento: decimal(descuento),
    Precio_Final: decimal(precioFinal),
    // Solo las terminadas son ingreso real (las activas aún no se cobran).
    Ingreso: decimal(terminada ? precioFinal : 0),
    // 0 = sin calificar. Para promediar, filtrar antes Calificada = 1.
    Estrellas: estrellas,
    Cantidad: 1,
    Terminada: terminada,
    Cancelada: cancelada,
    Activa: terminada || cancelada ? 0 : 1,
    Con_Promocion: descuento > 0 ? 1 : 0,
    Calificada: estrellas > 0 ? 1 : 0,
  };
}

// Lista de citas -> texto CSV. Las más antiguas primero.
export function citasACsvOlap(citas, mapas) {
  const filas = citas
    .map((c) => filaOlap(c, mapas))
    .filter(Boolean)
    .sort((a, b) => {
      const clave = (f) => f.Fecha.split("/").reverse().join("") + f.Hora;
      return clave(a) < clave(b) ? -1 : 1;
    });
  const lineas = [COLUMNAS_OLAP.join(";"), ...filas.map((f) => COLUMNAS_OLAP.map((c) => f[c]).join(";"))];
  return { csv: lineas.join("\r\n") + "\r\n", total: filas.length, omitidas: citas.length - filas.length };
}
