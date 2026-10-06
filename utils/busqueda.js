const normalizarTexto = (valor) => valor.toLocaleLowerCase("es-ES");

const contieneTermino = (valor, termino) => {
  if (valor === null || valor === undefined) return false;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return false;
    return (
      normalizarTexto(valor.toLocaleDateString("es-ES")).includes(termino) ||
      normalizarTexto(valor.toISOString()).includes(termino)
    );
  }

  if (typeof valor?.toDate === "function") {
    return contieneTermino(valor.toDate(), termino);
  }

  if (Array.isArray(valor)) {
    return valor.some((elemento) => contieneTermino(elemento, termino));
  }

  if (typeof valor === "object") {
    return Object.entries(valor).some(([campo, contenido]) => {
      const campoNormalizado = campo.toLowerCase();
      if (["id", "contrasena", "password"].includes(campoNormalizado)) return false;
      return contieneTermino(contenido, termino);
    });
  }

  return normalizarTexto(String(valor)).includes(termino);
};

export const obtenerTerminoBusqueda = (q) =>
  typeof q === "string" && q.trim() !== "" ? normalizarTexto(q.trim()) : null;

export const filtrarSnapshot = (snapshot, termino, transformar = (data) => data) =>
  snapshot.docs
    .map((doc) => ({ ...transformar(doc.data()), id: doc.id }))
    .filter((registro) => contieneTermino(registro, termino));
