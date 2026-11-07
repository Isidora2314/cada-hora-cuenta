// ------------------------------------------------------------
// Tests de la etapa 2: login y permisos por rol.
// Uso:  npm test   (antes: npm run importar y npm run usuarios)
// ------------------------------------------------------------
const { test, before, after } = require('node:test');
const assert = require('node:assert');

// Claves de prueba (no se usan las del .env)
process.env.JWT_SECRET = 'clave-de-test';
process.env.BOT_API_KEY = 'api-key-de-test';
const app = require('../src/app');

let servidor;
let URL_BASE;

before(() => new Promise((listo) => {
  servidor = app.listen(0, () => {
    URL_BASE = `http://localhost:${servidor.address().port}`;
    listo();
  });
}));
after(() => servidor.close());

// Ayudas
async function login(email) {
  const r = await fetch(`${URL_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Demo2026!' }),
  });
  return (await r.json()).token;
}
async function get(ruta, token) {
  const r = await fetch(`${URL_BASE}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, datos: await r.json() };
}

test('login con clave incorrecta es rechazado', async () => {
  const r = await fetch(`${URL_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@teleton.cl', password: 'mala' }),
  });
  assert.strictEqual(r.status, 401);
});

test('sin token no se puede ver profesionales', async () => {
  const r = await fetch(`${URL_BASE}/api/profesionales`);
  assert.strictEqual(r.status, 401);
});

test('PLANIFICADOR ve varios institutos', async () => {
  const { status, datos } = await get('/api/profesionales', await login('planificador@teleton.cl'));
  assert.strictEqual(status, 200);
  const institutos = new Set(datos.map((p) => p.it));
  assert.ok(institutos.size > 10, `ve ${institutos.size} institutos`);
});

test('JEFATURA de Arica solo ve el IT 11', async () => {
  const { datos } = await get('/api/profesionales', await login('jefatura.ari@teleton.cl'));
  assert.ok(datos.length > 0);
  assert.ok(datos.every((p) => p.it === 11));
});

test('JEFATURA no puede pedir otro instituto por la URL', async () => {
  const { datos } = await get('/api/profesionales?it=131', await login('jefatura.ari@teleton.cl'));
  assert.strictEqual(datos.length, 0);
});

test('PROFESIONAL solo se ve a sí mismo', async () => {
  const token = await login('profesional.71580@teleton.cl');
  const { datos } = await get('/api/profesionales', token);
  assert.ok(datos.every((p) => p.personaId === 71580));
  const otro = await get('/api/profesionales/137732', token);
  assert.strictEqual(otro.status, 404);
});

test('solo ADMIN entra a usuarios', async () => {
  const comoAdmin = await get('/api/usuarios', await login('admin@teleton.cl'));
  assert.strictEqual(comoAdmin.status, 200);
  assert.ok(comoAdmin.datos.every((u) => u.passwordHash === undefined), 'no expone contraseñas');
  const comoPlanificador = await get('/api/usuarios', await login('planificador@teleton.cl'));
  assert.strictEqual(comoPlanificador.status, 403);
});

test('ADMIN no ve datos de profesionales', async () => {
  const { status } = await get('/api/profesionales', await login('admin@teleton.cl'));
  assert.strictEqual(status, 403);
});

test('bot: sin API key es rechazado y con API key entra', async () => {
  const sin = await fetch(`${URL_BASE}/api/bot/ping`);
  assert.strictEqual(sin.status, 401);
  const con = await fetch(`${URL_BASE}/api/bot/ping`, { headers: { 'x-api-key': 'api-key-de-test' } });
  assert.strictEqual(con.status, 200);
});
