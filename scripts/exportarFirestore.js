// Exporta TODA la base de datos de Firestore (todas las colecciones).
//
//   node scripts/exportarFirestore.js
//
// Crea en la carpeta "respaldos/" (que NO se sube a GitHub porque tiene
// datos personales de los clientes):
//   - firestore_AAAA-MM-DD.json : respaldo completo, una lista por colección
//   - firestore_AAAA-MM-DD.xlsx : una hoja de Excel por colección
//   - olap_AAAA-MM-DD/          : un CSV por colección para el cubo OLAP (Pentaho)
//
// Usa la misma cuenta de servicio del backend (variables del archivo .env).
// No incluye las contraseñas: viven en Firebase Authentication, no en Firestore.

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import db from "../firebase.js";
import { leerRespaldo } from "../utils/respaldo.js";
import { respaldoACsvsOlap } from "../utils/olap.js";

// En Excel cada celda guarda un valor simple: objetos y listas van como texto.
const aCelda = (valor) => {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") return JSON.stringify(valor);
  return valor;
};

const fecha = new Date().toISOString().slice(0, 10);
mkdirSync("respaldos", { recursive: true });

const respaldo = await leerRespaldo(db);
const libro = new ExcelJS.Workbook();

for (const [nombre, documentos] of Object.entries(respaldo)) {
  // Columnas = todos los campos que aparecen en algún documento
  const campos = ["id", ...new Set(documentos.flatMap((d) => Object.keys(d)).filter((c) => c !== "id"))];
  const hoja = libro.addWorksheet(nombre.slice(0, 31)); // Excel acepta hasta 31 caracteres
  hoja.columns = campos.map((c) => ({ header: c, key: c, width: Math.min(Math.max(c.length + 4, 14), 40) }));
  documentos.forEach((d) => hoja.addRow(Object.fromEntries(campos.map((c) => [c, aCelda(d[c])]))));
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  console.log(`${nombre.padEnd(24)} ${documentos.length} documentos`);
}

writeFileSync(`respaldos/firestore_${fecha}.json`, JSON.stringify(respaldo, null, 2));
await libro.xlsx.writeFile(`respaldos/firestore_${fecha}.xlsx`);

// CSV del cubo OLAP a partir del mismo respaldo
const carpetaOlap = `respaldos/olap_${fecha}`;
mkdirSync(carpetaOlap, { recursive: true });
const { archivos } = respaldoACsvsOlap(respaldo);
archivos.forEach(({ nombre, csv }) => writeFileSync(`${carpetaOlap}/${nombre}`, csv, "utf8"));

console.log(`\nListo: respaldos/firestore_${fecha}.json, respaldos/firestore_${fecha}.xlsx`);
console.log(`       ${carpetaOlap}/ (${archivos.length} CSV para el cubo OLAP)`);
process.exit(0);
