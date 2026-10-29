import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import db from "../firebase.js";
import { calcularEstadisticas } from "./estadisticas.controller.js";
import { respaldoACsvsOlap } from "../utils/olap.js";
import { leerRespaldo } from "../utils/respaldo.js";

const clientesRef = db.collection("clientes");

// Firestore devuelve Timestamp; ExcelJS necesita Date
const aFecha = (valor) => (valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null);
const fechaHoy = () => new Date().toISOString().slice(0, 10);
const cordobas = (n) =>
  `C$${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ahoraEnNicaragua = () => new Date().toLocaleString("es-NI", { timeZone: "America/Managua" });

const AZUL = "FF1F4E78";

const darEstiloEncabezado = (hoja, fila = 1) => {
  const encabezado = hoja.getRow(fila);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  encabezado.alignment = { vertical: "middle", horizontal: "center" };
  hoja.views = [{ state: "frozen", ySplit: fila }];
  hoja.autoFilter = { from: { row: fila, column: 1 }, to: { row: fila, column: hoja.columnCount } };
};

// Hoja simple a partir de una lista: columnas = [{ header, key, width, numFmt }]
const agregarHojaTabla = (workbook, nombre, columnas, filas) => {
  const hoja = workbook.addWorksheet(nombre);
  hoja.columns = columnas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  filas.forEach((f) => hoja.addRow(f));
  darEstiloEncabezado(hoja);
  return hoja;
};

// ===================================================================
// GET /excel
// Hojas: Resumen, Por servicio, Por mes, Horarios, Hechos (para armar el
// cubo OLAP con tablas dinámicas o Power Pivot), Clientes.
// ===================================================================
export const exportarExcel = async (req, res) => {
  try {
    const [estadisticas, clientesSnap] = await Promise.all([calcularEstadisticas(), clientesRef.get()]);
    const { resumen, hechos } = estadisticas;

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    // ---- Resumen ----
    const hojaResumen = workbook.addWorksheet("Resumen");
    hojaResumen.columns = [{ width: 50 }, { width: 22 }];
    hojaResumen.mergeCells("A1:B1");
    hojaResumen.getCell("A1").value = "Autolavado Divino Niño — Resumen del negocio";
    hojaResumen.getCell("A1").font = { bold: true, size: 14, color: { argb: AZUL } };
    hojaResumen.getCell("A2").value = `Generado: ${ahoraEnNicaragua()}`;
    hojaResumen.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };
    const filasResumen = [
      ["Total de citas", resumen.totalCitas],
      ["Citas terminadas", resumen.terminadas],
      ["Citas activas (pendientes, confirmadas, en proceso)", resumen.activas],
      ["Citas canceladas", resumen.canceladas],
      ["Tasa de cancelación (%)", resumen.tasaCancelacion],
      ["Ingresos (citas terminadas)", resumen.ingresos],
      ["Ingresos por cobrar (citas activas)", resumen.ingresosPorCobrar],
      ["Ticket promedio", resumen.ticketPromedio],
      ["Descuentos otorgados", resumen.descuentosOtorgados],
      ["Clientes registrados", resumen.totalClientes],
      ["Clientes que han agendado", resumen.clientesConCitas],
      ["Calificación promedio (1 a 5)", resumen.calificacionPromedio ?? "Sin calificaciones"],
      ["Total de calificaciones", resumen.totalCalificaciones],
    ];
    filasResumen.forEach(([etiqueta, valor], i) => {
      const fila = hojaResumen.getRow(4 + i);
      fila.getCell(1).value = etiqueta;
      fila.getCell(2).value = valor;
      fila.getCell(1).font = { bold: true };
      if (/Ingresos|Ticket|Descuentos/.test(etiqueta)) fila.getCell(2).numFmt = '"C$"#,##0.00';
    });

    // ---- Por servicio y por mes ----
    agregarHojaTabla(
      workbook,
      "Por servicio",
      [
        { header: "Servicio", key: "servicio", width: 30 },
        { header: "Citas", key: "citas", width: 10 },
        { header: "Ingresos (C$)", key: "ingresos", width: 16, numFmt: "#,##0.00" },
      ],
      estadisticas.porServicio
    );
    agregarHojaTabla(
      workbook,
      "Por mes",
      [
        { header: "Mes (AAAA-MM)", key: "mes", width: 16 },
        { header: "Citas", key: "citas", width: 10 },
        { header: "Ingresos (C$)", key: "ingresos", width: 16, numFmt: "#,##0.00" },
      ],
      estadisticas.porMes
    );

    // ---- Horarios: por hora y por día de la semana ----
    const hojaHorarios = agregarHojaTabla(
      workbook,
      "Horarios",
      [
        { header: "Hora", key: "hora", width: 10 },
        { header: "Citas", key: "citas", width: 10 },
      ],
      estadisticas.porHora
    );
    hojaHorarios.getColumn(4).width = 18;
    hojaHorarios.getCell("D1").value = "Día de la semana";
    hojaHorarios.getCell("E1").value = "Citas";
    ["D1", "E1"].forEach((celda) => {
      hojaHorarios.getCell(celda).font = { bold: true, color: { argb: "FFFFFFFF" } };
      hojaHorarios.getCell(celda).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    });
    estadisticas.porDiaSemana.forEach((d, i) => {
      hojaHorarios.getCell(`D${i + 2}`).value = d.dia;
      hojaHorarios.getCell(`E${i + 2}`).value = d.citas;
    });

    // ---- Hechos: una fila por cita, lista para el cubo OLAP ----
    agregarHojaTabla(
      workbook,
      "Hechos",
      [
        { header: "ID cita", key: "cita_id", width: 24 },
        { header: "Fecha", key: "fecha", width: 12, numFmt: "dd/mm/yyyy" },
        { header: "Año", key: "anio", width: 8 },
        { header: "Mes número", key: "mes_numero", width: 11 },
        { header: "Mes", key: "mes", width: 12 },
        { header: "Año-Mes", key: "anio_mes", width: 10 },
        { header: "Día de la semana", key: "dia_semana", width: 15 },
        { header: "Hora", key: "hora", width: 8 },
        { header: "Franja", key: "franja", width: 10 },
        { header: "Servicio", key: "servicio", width: 26 },
        { header: "Cliente", key: "cliente", width: 26 },
        { header: "Vehículo", key: "vehiculo", width: 18 },
        { header: "Placa", key: "placa", width: 12 },
        { header: "Empleado", key: "empleado", width: 22 },
        { header: "Estado", key: "estado", width: 12 },
        { header: "Promoción", key: "promocion", width: 22 },
        { header: "Precio original", key: "precio_original", width: 14, numFmt: "#,##0.00" },
        { header: "Descuento", key: "descuento", width: 12, numFmt: "#,##0.00" },
        { header: "Precio final", key: "precio_final", width: 12, numFmt: "#,##0.00" },
        { header: "Estrellas", key: "estrellas", width: 9 },
        { header: "Cantidad", key: "cantidad", width: 9 },
      ],
      [...hechos].sort((a, b) => (b.fecha || 0) - (a.fecha || 0))
    );

    // ---- Clientes ----
    agregarHojaTabla(
      workbook,
      "Clientes",
      [
        { header: "ID", key: "id", width: 24 },
        { header: "Nombre", key: "nombre", width: 28 },
        { header: "Teléfono", key: "telefono", width: 16 },
        { header: "Email", key: "email", width: 30 },
        { header: "Vehículos", key: "vehiculos", width: 40 },
        { header: "Fecha de registro", key: "fecha_registro", width: 20, numFmt: "dd/mm/yyyy" },
      ],
      clientesSnap.docs.map((doc) => {
        const c = doc.data();
        return {
          id: doc.id,
          nombre: c.nombre,
          telefono: c.telefono,
          email: c.email,
          vehiculos: (c.vehiculos || []).map((v) => `${v.placa} (${v.modelo})`).join(", "),
          fecha_registro: aFecha(c.fecha_registro),
        };
      })
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_divino_nino_${fechaHoy()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error al exportar Excel:", error);
    res.status(500).json({ mensaje: "Error al generar el Excel.", error: error.message });
  }
};

// ===================================================================
// GET /reporte/pdf
// Reporte del negocio para imprimir: indicadores, servicios, meses,
// horas pico, días de la semana y empleados.
// ===================================================================

// Tabla sencilla: todas las columnas de una fila se escriben con la misma "y".
const dibujarTabla = (doc, titulo, columnas, filas) => {
  const izquierda = doc.page.margins.left;
  const anchoTotal = doc.page.width - izquierda - doc.page.margins.right;
  // Si la tabla completa no cabe en lo que queda de la página (pero sí en
  // una nueva), empieza en la siguiente para no quedar partida.
  const altoTabla = 50 + (Math.max(filas.length, 1) + 1) * 18;
  const espacioLibre = doc.page.height - doc.page.margins.bottom - doc.y;
  const altoPagina = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  if (altoTabla > espacioLibre && altoTabla <= altoPagina) doc.addPage();

  doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor("#1F4E78").text(titulo, izquierda);
  doc.moveDown(0.3);

  const dibujarFila = (valores, encabezado, fondo) => {
    if (doc.y > doc.page.height - 80) doc.addPage();
    const y = doc.y;
    if (fondo) doc.rect(izquierda, y - 4, anchoTotal, 18).fill(fondo);
    doc.font(encabezado ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(encabezado ? "#FFFFFF" : "#0F172A");
    let x = izquierda;
    valores.forEach((valor, i) => {
      const ancho = anchoTotal * columnas[i].ancho;
      doc.text(String(valor ?? ""), x + 4, y, {
        width: ancho - 8,
        align: columnas[i].derecha ? "right" : "left",
        lineBreak: false,
      });
      x += ancho;
    });
    doc.x = izquierda;
    doc.y = y + 18;
  };

  dibujarFila(columnas.map((c) => c.titulo), true, "#1F4E78");
  if (filas.length === 0) {
    dibujarFila(["Sin datos", ...columnas.slice(1).map(() => "")], false, null);
    return;
  }
  filas.forEach((fila, i) => dibujarFila(fila, false, i % 2 ? "#F1F5F9" : null));
};

export const exportarPdf = async (req, res) => {
  try {
    const { resumen, porServicio, porMes, porHora, porDiaSemana, porEmpleado } = await calcularEstadisticas();

    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_divino_nino_${fechaHoy()}.pdf"`);
    doc.pipe(res);

    // Encabezado
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#1F4E78").text("Autolavado Divino Niño");
    doc.font("Helvetica").fontSize(12).fillColor("#64748B").text("Reporte del negocio");
    doc.fontSize(10).text(`Generado: ${ahoraEnNicaragua()}`);

    dibujarTabla(
      doc,
      "Indicadores principales",
      [
        { titulo: "Indicador", ancho: 0.62 },
        { titulo: "Valor", ancho: 0.38, derecha: true },
      ],
      [
        ["Total de citas", resumen.totalCitas],
        ["Citas terminadas", resumen.terminadas],
        ["Citas activas", resumen.activas],
        ["Citas canceladas", `${resumen.canceladas} (${resumen.tasaCancelacion} %)`],
        ["Ingresos (citas terminadas)", cordobas(resumen.ingresos)],
        ["Ingresos por cobrar", cordobas(resumen.ingresosPorCobrar)],
        ["Ticket promedio", cordobas(resumen.ticketPromedio)],
        ["Descuentos otorgados", cordobas(resumen.descuentosOtorgados)],
        ["Clientes registrados / que han agendado", `${resumen.totalClientes} / ${resumen.clientesConCitas}`],
        [
          "Calificación promedio",
          resumen.calificacionPromedio
            ? `${resumen.calificacionPromedio} de 5 (${resumen.totalCalificaciones} opiniones)`
            : "Sin calificaciones",
        ],
      ]
    );

    dibujarTabla(
      doc,
      "Servicios más solicitados",
      [
        { titulo: "Servicio", ancho: 0.55 },
        { titulo: "Citas", ancho: 0.15, derecha: true },
        { titulo: "Ingresos", ancho: 0.3, derecha: true },
      ],
      porServicio.map((s) => [s.servicio, s.citas, cordobas(s.ingresos)])
    );

    dibujarTabla(
      doc,
      "Citas e ingresos por mes",
      [
        { titulo: "Mes", ancho: 0.4 },
        { titulo: "Citas", ancho: 0.25, derecha: true },
        { titulo: "Ingresos", ancho: 0.35, derecha: true },
      ],
      porMes.map((m) => [m.mes, m.citas, cordobas(m.ingresos)])
    );

    dibujarTabla(
      doc,
      "Horas pico (las 6 con más citas)",
      [
        { titulo: "Hora", ancho: 0.5 },
        { titulo: "Citas", ancho: 0.5, derecha: true },
      ],
      [...porHora].sort((a, b) => b.citas - a.citas).slice(0, 6).map((h) => [h.hora, h.citas])
    );

    dibujarTabla(
      doc,
      "Citas por día de la semana",
      [
        { titulo: "Día", ancho: 0.5 },
        { titulo: "Citas", ancho: 0.5, derecha: true },
      ],
      porDiaSemana.map((d) => [d.dia, d.citas])
    );

    dibujarTabla(
      doc,
      "Citas por empleado",
      [
        { titulo: "Empleado", ancho: 0.55 },
        { titulo: "Citas", ancho: 0.15, derecha: true },
        { titulo: "Ingresos", ancho: 0.3, derecha: true },
      ],
      porEmpleado.map((e) => [e.empleado, e.citas, cordobas(e.ingresos)])
    );

    // Pie de página con el número de página. Se baja el margen inferior a 0
    // mientras se escribe, para que PDFKit no agregue una página por cada pie.
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i);
      const margenAbajo = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#94A3B8")
        .text(`Página ${i + 1} de ${paginas.count}`, 50, doc.page.height - 35, {
          align: "center",
          width: doc.page.width - 100,
        });
      doc.page.margins.bottom = margenAbajo;
    }

    doc.end();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    if (!res.headersSent) res.status(500).json({ mensaje: "Error al generar el PDF.", error: error.message });
    else res.end();
  }
};

// ===================================================================
// GET /csv            -> ZIP con un CSV por cada colección
// GET /csv/:coleccion -> CSV de una sola colección
// Columnas = todos los campos que aparecen en los documentos.
// ===================================================================

const COLECCIONES_CSV = [
  "clientes",
  "empleados",
  "servicios",
  "catalogo",
  "citas",
  "servicio_vendidos",
  "usuarios",
];

// Campos que nunca se exportan
const CAMPOS_EXCLUIDOS = ["contrasena"];

// BOM para que Excel lea bien las tildes y la ñ
const BOM = "\uFEFF";

// Convierte cualquier valor de Firestore en texto para una celda
const valorCsv = (valor) => {
  if (valor === null || valor === undefined) return "";
  if (valor?.toDate) return valor.toDate().toISOString(); // Timestamp
  if (valor instanceof Date) return valor.toISOString();
  if (valor?.path && valor?.firestore) return valor.path; // DocumentReference
  if (typeof valor === "object") return JSON.stringify(valor); // arreglos y mapas
  return String(valor);
};

// Comillas si el texto tiene coma, comillas o saltos de línea
const escaparCsv = (texto) => (/[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto);

const coleccionACsv = async (nombre) => {
  const snapshot = await db.collection(nombre).get();
  const filas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const columnas = ["id"];
  filas.forEach((fila) =>
    Object.keys(fila).forEach((campo) => {
      if (!columnas.includes(campo) && !CAMPOS_EXCLUIDOS.includes(campo)) columnas.push(campo);
    })
  );

  const lineas = [
    columnas.map(escaparCsv).join(","),
    ...filas.map((fila) => columnas.map((c) => escaparCsv(valorCsv(fila[c]))).join(",")),
  ];

  return BOM + lineas.join("\r\n");
};

export const exportarCsvColeccion = async (req, res) => {
  try {
    const { coleccion } = req.params;
    if (!COLECCIONES_CSV.includes(coleccion)) {
      return res.status(404).json({
        mensaje: `Colección no válida. Usa una de: ${COLECCIONES_CSV.join(", ")}.`,
      });
    }

    const csv = await coleccionACsv(coleccion);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${coleccion}_${fechaHoy()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Error al exportar CSV:", error);
    res.status(500).json({ mensaje: "Error al generar el CSV.", error: error.message });
  }
};

// ===================================================================
// GET /csv/olap -> ZIP con los CSV del cubo OLAP en Pentaho (carpeta datos/).
// Lee el respaldo completo de la base (todas las colecciones) y arma
// Citas.csv (hechos) + un CSV por colección. Separador ";", fechas
// dd/MM/yyyy y sin vacíos. La lógica está en utils/olap.js.
// ===================================================================
export const exportarCsvOlap = async (req, res) => {
  try {
    const respaldo = await leerRespaldo(db);
    const { archivos, citasSinFecha } = respaldoACsvsOlap(respaldo);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="olap_divino_nino_${fechaHoy()}.zip"`);
    res.setHeader("X-Archivos", String(archivos.length));
    res.setHeader("X-Citas-Sin-Fecha", String(citasSinFecha));

    const zip = archiver("zip", { zlib: { level: 9 } });
    zip.on("error", (error) => {
      console.error("Error al armar el ZIP del cubo:", error);
      res.end();
    });
    zip.pipe(res);
    archivos.forEach(({ nombre, csv }) => zip.append(csv, { name: nombre }));
    await zip.finalize();
  } catch (error) {
    console.error("Error al exportar el CSV del cubo:", error);
    if (!res.headersSent) res.status(500).json({ mensaje: "Error al generar el CSV del cubo.", error: error.message });
    else res.end();
  }
};

export const exportarCsvTodo = async (req, res) => {
  try {
    const archivos = await Promise.all(
      COLECCIONES_CSV.map(async (nombre) => ({ nombre, csv: await coleccionACsv(nombre) }))
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="datos_divino_nino_${fechaHoy()}.zip"`);

    const zip = archiver("zip", { zlib: { level: 9 } });
    zip.on("error", (error) => {
      console.error("Error al armar el ZIP:", error);
      res.end();
    });
    zip.pipe(res);
    archivos.forEach(({ nombre, csv }) => zip.append(csv, { name: `${nombre}.csv` }));
    await zip.finalize();
  } catch (error) {
    console.error("Error al exportar CSV:", error);
    if (!res.headersSent) res.status(500).json({ mensaje: "Error al generar los CSV.", error: error.message });
    else res.end();
  }
};
