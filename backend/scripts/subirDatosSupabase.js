// ------------------------------------------------------------
// Sube (o vuelve a subir) los JSON de backend/data a Supabase.
// Sirve para dejar la base "limpia" antes de la demo:
//   npm run importar        (opcional: regenera los JSON desde los Excel)
//   npm run subir-datos     (reemplaza en Supabase todas las tablas)
// Necesita DATABASE_URL en el .env.
// ------------------------------------------------------------
require('dotenv').config();
const repo = require('../src/repositorio/archivoJson');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el archivo .env (la cadena de conexión de Supabase).');
    process.exit(1);
  }
  await repo.iniciar();
  const tablas = repo.tablasEnArchivos();
  tablas.forEach((t) => repo.guardar(t, repo.leerArchivo(t)));
  await repo.cerrar();
  console.log(`Listo: ${tablas.length} tablas subidas a Supabase.`);
  console.log('Si el backend de Render está corriendo, reinícialo (Manual Deploy → Restart) para que lea los datos nuevos.');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
