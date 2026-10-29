// Arma los CSV del cubo OLAP a partir de un respaldo ya guardado, sin
// conectarse a Firebase.
//
//   node scripts/olapDesdeRespaldo.js                       (usa el respaldo más reciente)
//   node scripts/olapDesdeRespaldo.js respaldos/firestore_2026-10-28.json
//
// Deja los CSV en respaldos/olap_AAAA-MM-DD/ (la fecha es la del respaldo).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { respaldoACsvsOlap } from "../utils/olap.js";

let archivo = process.argv[2];
if (!archivo) {
  const respaldos = readdirSync("respaldos").filter((f) => /^firestore_.*\.json$/.test(f)).sort();
  if (!respaldos.length) {
    console.error("No hay respaldos en respaldos/. Corre antes: node scripts/exportarFirestore.js");
    process.exit(1);
  }
  archivo = `respaldos/${respaldos.at(-1)}`;
}

const respaldo = JSON.parse(readFileSync(archivo, "utf8"));
const fecha = basename(archivo).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString().slice(0, 10);
const carpeta = `respaldos/olap_${fecha}`;
mkdirSync(carpeta, { recursive: true });

const { archivos, citasSinFecha } = respaldoACsvsOlap(respaldo);
archivos.forEach(({ nombre, csv, filas }) => {
  writeFileSync(`${carpeta}/${nombre}`, csv, "utf8");
  console.log(`${nombre.padEnd(32)} ${filas} filas`);
});
if (citasSinFecha) console.log(`\n${citasSinFecha} cita(s) sin fecha válida quedaron fuera de Citas.csv`);
console.log(`\nListo: ${carpeta}/ (desde ${archivo})`);
