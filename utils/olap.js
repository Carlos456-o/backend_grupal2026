// CSV de origen para el cubo OLAP en Pentaho (carpeta datos/ del proyecto).
// Se arma a partir del respaldo completo de la base (utils/respaldo.js o el
// archivo respaldos/firestore_AAAA-MM-DD.json):
//   - Citas.csv: tabla de hechos, una fila por cita con sus dimensiones
//   - un CSV por cada otra colección (Clientes.csv, Empleados.csv, ...)
//   - las listas de objetos van en su propio CSV (Clientes_Vehiculos.csv)
// Reglas del cubo de actas:
//   - separador ";", UTF-8 sin BOM, con cabecera
//   - fechas en dd/MM/yyyy y decimales con punto (2 decimales)
//   - CERO valores vacíos: textos -> "SIN ...", números -> 0,
//     fechas -> 01/01/1900
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

// ===================================================================
// Resto de colecciones: CSV genérico con las mismas reglas.
// ===================================================================

const CAMPOS_EXCLUIDOS = new Set(["contrasena", "password"]);
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;
const FECHA_VACIA = "01/01/1900";

// "servicio_vendidos" -> "Servicio_Vendidos"
const titulo = (nombre) =>
  String(nombre)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("_");

// "Servicio_Vendidos" -> "Servicio_Vendido", para que la llave quede igual
// que en Citas.csv (Cod_Cliente, Cod_Empleado, Cod_Servicio).
const singular = (nombre) => titulo(nombre).replace(/s$/i, "");

const vacio = (v) => v === null || v === undefined || v === "";

// { vehiculo: { placa } } -> { vehiculo_placa }. Las listas de objetos no
// caben en una celda: se apartan en "hijos" y queda solo su cantidad.
function aplanar(objeto, prefijo, fila, hijos) {
  for (const [campo, valor] of Object.entries(objeto || {})) {
    if (CAMPOS_EXCLUIDOS.has(campo)) continue;
    const clave = prefijo ? `${prefijo}_${campo}` : campo;
    if (Array.isArray(valor)) {
      // Lista vacía: se omite y la columna se rellena con 0 / "SIN DATO".
      if (!valor.length) continue;
      if (valor.some((x) => x && typeof x === "object")) {
        hijos[clave] = valor;
        fila[`${clave}_cantidad`] = valor.length;
      } else {
        fila[clave] = valor.filter((x) => !vacio(x)).join(", ");
      }
    } else if (valor && typeof valor === "object") {
      aplanar(valor, clave, fila, hijos);
    } else {
      fila[clave] = valor;
    }
  }
}

// Tipo de la columna según sus valores, para saber cómo rellenar los vacíos.
function tipoColumna(valores) {
  const llenos = valores.filter((v) => !vacio(v));
  if (!llenos.length) return "texto";
  if (llenos.every((v) => typeof v === "boolean")) return "booleano";
  if (llenos.every((v) => typeof v === "number")) return llenos.every(Number.isInteger) ? "entero" : "decimal";
  if (llenos.every((v) => typeof v === "string" && FECHA_ISO.test(v))) return "fecha";
  return "texto";
}

function celda(valor, tipo) {
  switch (tipo) {
    case "booleano":
      return valor ? 1 : 0;
    case "entero":
      return Number(valor) || 0;
    case "decimal":
      return decimal(valor);
    case "fecha": {
      const fecha = aFecha(valor);
      return fecha
        ? `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`
        : FECHA_VACIA;
    }
    default:
      return texto(valor, "SIN DATO");
  }
}

// filas: objetos planos. llaves: columnas que van primero y siempre son texto.
function tablaCsv(filas, llaves) {
  const columnas = [...new Set([...llaves, ...filas.flatMap((f) => Object.keys(f)), "Cantidad"])];
  const tipos = columnas.map((c) => (llaves.includes(c) ? "texto" : tipoColumna(filas.map((f) => f[c]))));
  const encabezado = columnas.map((c) => (llaves.includes(c) || c === "Cantidad" ? c : titulo(c)));
  const lineas = [
    encabezado.join(";"),
    ...filas.map((f) => columnas.map((c, i) => (c === "Cantidad" ? 1 : celda(f[c], tipos[i]))).join(";")),
  ];
  return lineas.join("\r\n") + "\r\n";
}

// Una colección -> su CSV y, si tiene listas de objetos, un CSV por lista.
export function coleccionACsvsOlap(coleccion, documentos) {
  const llave = `Cod_${singular(coleccion)}`;
  const filas = [];
  const hijos = {}; // campo -> filas del CSV hijo

  documentos.forEach((doc) => {
    const { id, ...datos } = doc;
    const fila = { [llave]: id };
    const listas = {};
    aplanar(datos, "", fila, listas);
    filas.push(fila);

    Object.entries(listas).forEach(([campo, items]) => {
      hijos[campo] ??= [];
      items.forEach((item, i) => {
        const hija = { [llave]: id, Orden: i + 1 };
        if (item && typeof item === "object") aplanar(item, "", hija, {});
        else hija.valor = item;
        hijos[campo].push(hija);
      });
    });
  });

  return [
    { nombre: `${titulo(coleccion)}.csv`, csv: tablaCsv(filas, [llave]), filas: filas.length },
    ...Object.entries(hijos).map(([campo, filasHijo]) => ({
      nombre: `${titulo(coleccion)}_${titulo(campo)}.csv`,
      csv: tablaCsv(filasHijo, [llave, "Orden"]),
      filas: filasHijo.length,
    })),
  ];
}

// Respaldo completo { coleccion: [docs] } -> todos los CSV del cubo.
// Citas.csv es la tabla de hechos (con clientes, empleados y servicios unidos).
export function respaldoACsvsOlap(respaldo) {
  const aMapa = (lista = []) => new Map(lista.map((d) => [d.id, d]));
  const { csv, total, omitidas } = citasACsvOlap(respaldo.citas || [], {
    clientes: aMapa(respaldo.clientes),
    empleados: aMapa(respaldo.empleados),
    servicios: aMapa(respaldo.servicios),
  });

  const archivos = [{ nombre: "Citas.csv", csv, filas: total }];
  Object.entries(respaldo)
    .filter(([coleccion]) => coleccion !== "citas")
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([coleccion, documentos]) => archivos.push(...coleccionACsvsOlap(coleccion, documentos)));

  return { archivos, citasSinFecha: omitidas };
}
