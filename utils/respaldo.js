// Lectura completa de Firestore, compartida por el script de respaldo
// (scripts/exportarFirestore.js) y por el CSV del cubo OLAP.
// Devuelve { coleccion: [ { id, ...campos } ] } con el mismo formato que
// respaldos/firestore_AAAA-MM-DD.json.

// Convierte los valores de Firestore a algo que se pueda guardar:
// Timestamp -> fecha ISO, referencias -> su ruta, objetos y listas por dentro.
export const limpiar = (valor) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor.toDate === "function") return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  if (valor.path && valor.firestore) return valor.path; // DocumentReference
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, limpiar(v)]));
  }
  return valor;
};

// Todas las colecciones de la base, sin tener que listarlas a mano.
export async function leerRespaldo(db) {
  const colecciones = await db.listCollections();
  const respaldo = {};
  for (const coleccion of colecciones) {
    const snapshot = await coleccion.get();
    respaldo[coleccion.id] = snapshot.docs.map((doc) => ({ id: doc.id, ...limpiar(doc.data()) }));
  }
  return respaldo;
}
