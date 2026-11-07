// ------------------------------------------------------------
// Edición de parámetros: qué tablas se pueden editar y por qué campo
// se identifica cada fila. Se usa para guardar (PUT) y para simular.
// ------------------------------------------------------------

// tabla -> campo que identifica cada fila
const TABLAS_EDITABLES = {
  distribucion: 'cargo',
  factor_grupal: 'codEsp',
  calendario: 'mes',
  parametros_generales: 'clave',
  asignaciones_catalogo: 'id',
};

// Devuelve una COPIA de la tabla con el cambio aplicado (no guarda nada)
function aplicarCambio(datos, tabla, clave, valores) {
  const campo = TABLAS_EDITABLES[tabla];
  if (!campo) throw new Error(`La tabla "${tabla}" no se puede editar`);

  const copia = JSON.parse(JSON.stringify(datos));
  const fila = copia.find((x) => String(x[campo]) === String(clave));
  if (!fila) throw new Error(`No existe "${clave}" en ${tabla}`);

  // Une los valores nuevos (también dentro de objetos, ej: tramos.mayorIgual40.dir)
  const identificador = fila[campo];
  unirProfundo(fila, valores);
  fila[campo] = identificador; // el campo que identifica la fila no se puede cambiar
  return { copia, anterior: datos.find((x) => String(x[campo]) === String(clave)), nueva: fila };
}

function unirProfundo(destino, origen) {
  Object.keys(origen || {}).forEach((k) => {
    const v = origen[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && destino[k] && typeof destino[k] === 'object') {
      unirProfundo(destino[k], v);
    } else {
      destino[k] = v;
    }
  });
}

module.exports = { TABLAS_EDITABLES, aplicarCambio };
