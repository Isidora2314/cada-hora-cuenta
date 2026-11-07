// ------------------------------------------------------------
// Envía un Excel al backend IGUAL que lo hace Blue Prism.
// Sirve para probar la API y como respaldo en la demo.
//
// Uso:
//   node scripts/enviarReporte.js buk excel/demo/BUK_Agosto_2026_demo.xlsx
//   node scripts/enviarReporte.js sic excel/demo/SIC_Ene_Jul_2026_demo.xlsx
//   (opcional, 3er parámetro: URL del backend, por defecto http://localhost:4000)
// ------------------------------------------------------------
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');

const [tipo, archivo, url = 'http://localhost:4000'] = process.argv.slice(2);
if (!['buk', 'sic'].includes(tipo) || !archivo) {
  console.log('Uso: node scripts/enviarReporte.js <buk|sic> <archivo.xlsx> [url]');
  process.exit(1);
}

// 1) Leer el Excel. Los encabezados son la primera fila que contiene "PersonaId".
const libro = XLSX.readFile(archivo);
const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
const iEnc = filas.findIndex((f) => f.includes('PersonaId'));
if (iEnc < 0) { console.error('No encontré la fila de encabezados (con "PersonaId")'); process.exit(1); }
const encabezados = filas[iEnc];

// 2) Cada fila -> objeto con los nombres de columna del Excel (igual que una colección de Blue Prism)
const registros = filas.slice(iEnc + 1).map((f) => {
  const r = {};
  encabezados.forEach((h, i) => { if (h) r[h] = f[i]; });
  return r;
});

// 3) Enviar
(async () => {
  console.log(`Enviando ${registros.length} filas de ${path.basename(archivo)} a ${url}/api/bot/${tipo} ...`);
  const respuesta = await fetch(`${url}/api/bot/${tipo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.BOT_API_KEY || '' },
    body: JSON.stringify({ archivo: path.basename(archivo), registros }),
  });
  const json = await respuesta.json();
  if (!respuesta.ok) { console.error('Error:', json); process.exit(1); }
  console.log('Resumen:', json.resumen);
  if (json.cambiosPorTipo) console.log('Cambios detectados:', json.cambiosPorTipo);
  console.log(`Errores encontrados: ${json.totalErrores}`);
  (json.errores || []).slice(0, 10).forEach((e) => console.log(`  fila ${e.fila}: ${e.tipo} - ${e.mensaje}`));
})();
