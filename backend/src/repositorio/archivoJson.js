// ------------------------------------------------------------
// Capa "repositorio": es la ÚNICA parte del código que sabe
// dónde se guardan los datos.
// Hoy guarda en archivos JSON dentro de /backend/data.
// Más adelante se reemplaza por PostgreSQL sin tocar el resto.
// ------------------------------------------------------------
const fs = require('fs');
const path = require('path');

// Carpeta donde viven los archivos JSON
const CARPETA_DATOS = path.join(__dirname, '..', '..', 'data');

// Devuelve la ruta completa de una "tabla" (ej: 'distribucion' -> data/distribucion.json)
function rutaDe(tabla) {
  return path.join(CARPETA_DATOS, `${tabla}.json`);
}

// Lee una tabla completa. Si el archivo no existe, devuelve una lista vacía.
function leer(tabla) {
  const ruta = rutaDe(tabla);
  if (!fs.existsSync(ruta)) return [];
  const texto = fs.readFileSync(ruta, 'utf-8');
  return JSON.parse(texto);
}

// Guarda (reemplaza) una tabla completa
function guardar(tabla, datos) {
  if (!fs.existsSync(CARPETA_DATOS)) fs.mkdirSync(CARPETA_DATOS, { recursive: true });
  fs.writeFileSync(rutaDe(tabla), JSON.stringify(datos, null, 2), 'utf-8');
}

module.exports = { leer, guardar };
