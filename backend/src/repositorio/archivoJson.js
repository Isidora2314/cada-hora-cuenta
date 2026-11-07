// ------------------------------------------------------------
// Capa "repositorio": es la ÚNICA parte del código que sabe
// dónde se guardan los datos. Tiene dos modos:
//
//  1) Archivos JSON en /backend/data   (si NO hay DATABASE_URL)
//     Es el modo para trabajar en local y para los tests.
//
//  2) Supabase / PostgreSQL            (si hay DATABASE_URL)
//     Cada "tabla" se guarda como una fila de la tabla `tablas`
//     (nombre + datos en jsonb). Al arrancar se leen todas a memoria,
//     así leer() sigue siendo instantáneo, y cada guardar() se escribe
//     en Supabase en segundo plano y en orden.
//     Si Supabase está vacío, se llena con los JSON del repo.
//
// El resto del código usa siempre leer(tabla) y guardar(tabla, datos).
// ------------------------------------------------------------
const fs = require('fs');
const path = require('path');

// Carpeta donde viven los archivos JSON
const CARPETA_DATOS = path.join(__dirname, '..', '..', 'data');

let pool = null;              // conexión a Postgres (solo en modo Supabase)
const memoria = new Map();    // tabla -> texto JSON (modo Supabase)
const pendientes = new Map(); // tablas por escribir en Supabase
let escribiendo = Promise.resolve();

const rutaDe = (tabla) => path.join(CARPETA_DATOS, `${tabla}.json`);

function leerArchivo(tabla) {
  const ruta = rutaDe(tabla);
  if (!fs.existsSync(ruta)) return [];
  return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
}

function tablasEnArchivos() {
  if (!fs.existsSync(CARPETA_DATOS)) return [];
  return fs.readdirSync(CARPETA_DATOS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
}

// ---------------- API usada por todo el backend ----------------

// Lee una tabla completa. Si no existe, devuelve una lista vacía.
// Siempre devuelve una copia nueva (modificarla no cambia lo guardado).
function leer(tabla) {
  if (!pool) return leerArchivo(tabla);
  const texto = memoria.get(tabla);
  return texto === undefined ? [] : JSON.parse(texto);
}

// Guarda (reemplaza) una tabla completa
function guardar(tabla, datos) {
  if (!pool) {
    if (!fs.existsSync(CARPETA_DATOS)) fs.mkdirSync(CARPETA_DATOS, { recursive: true });
    fs.writeFileSync(rutaDe(tabla), JSON.stringify(datos, null, 2), 'utf-8');
    return;
  }
  const texto = JSON.stringify(datos);
  memoria.set(tabla, texto);
  pendientes.set(tabla, texto);
  escribiendo = escribiendo.then(escribirPendientes);
}

// ---------------- Modo Supabase ----------------

async function escribirPendientes() {
  for (const [tabla, texto] of [...pendientes]) {
    pendientes.delete(tabla);
    try {
      await pool.query(
        `insert into tablas (nombre, datos, actualizado) values ($1, $2::jsonb, now())
         on conflict (nombre) do update set datos = excluded.datos, actualizado = now()`,
        [tabla, texto],
      );
    } catch (e) {
      console.error(`No se pudo guardar "${tabla}" en Supabase:`, e.message);
    }
  }
}

// Conecta con Supabase (si hay DATABASE_URL) y carga las tablas a memoria.
// Debe llamarse antes de levantar el servidor.
async function iniciar() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('Datos: archivos JSON en backend/data (no hay DATABASE_URL)');
    return;
  }
  const { Pool } = require('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });
  pool.on('error', (e) => console.error('Error de conexión con Supabase:', e.message));

  await pool.query(`create table if not exists tablas (
    nombre text primary key,
    datos jsonb not null,
    actualizado timestamptz not null default now()
  )`);
  // Protección de datos: sin políticas, la API pública de Supabase no puede leer esta tabla.
  // Solo el backend (que se conecta con el usuario dueño de la base) tiene acceso.
  await pool.query('alter table tablas enable row level security');

  const { rows } = await pool.query('select nombre, datos::text as texto from tablas');
  rows.forEach((r) => memoria.set(r.nombre, r.texto));

  // Las tablas que aún no están en Supabase se llenan con los JSON del repo
  const faltantes = tablasEnArchivos().filter((t) => !memoria.has(t));
  faltantes.forEach((t) => guardar(t, leerArchivo(t)));
  await esperarEscrituras();

  console.log(`Datos: Supabase (${memoria.size} tablas; ${faltantes.length} copiadas desde los JSON del repo)`);
}

// Espera a que todo lo guardado llegue a Supabase (útil en scripts)
async function esperarEscrituras() {
  await escribiendo;
  if (pendientes.size) { escribiendo = escribiendo.then(escribirPendientes); await escribiendo; }
}

async function cerrar() {
  await esperarEscrituras();
  if (pool) { await pool.end(); pool = null; memoria.clear(); }
}

const usaSupabase = () => Boolean(pool);

module.exports = { leer, guardar, iniciar, esperarEscrituras, cerrar, usaSupabase, tablasEnArchivos, leerArchivo };
