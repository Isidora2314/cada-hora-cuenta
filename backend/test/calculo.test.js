// ------------------------------------------------------------
// Tests de la etapa 3: el motor de cálculo debe coincidir con el Excel.
// Uso:  npm test
// ------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert');
const repo = require('../src/repositorio/archivoJson');
const { calcularTodo } = require('../src/servicios/planificacion');
const { validar } = require('../scripts/validar');

// Calcula la fila de una persona en un instituto
function calcular(personaId, it) {
  const filas = repo.leer('planificacion_base').filter((f) => f.personaId === personaId && f.it === it);
  return calcularTodo({ filas })[0];
}

test('Caso 1: PersonaId 137732 · Arica · MEDICO FISIATRA 40 h · Líder Equipo 2 h', () => {
  const r = calcular(137732, 11);
  // Semana de mayo (40 h): %Dir final 0,609375 y %Ind final 0,140625
  assert.strictEqual(r.meses[4].pctDirFinal, 0.6094);
  assert.strictEqual(r.meses[4].pctIndFinal, 0.1406);
  assert.strictEqual(r.meses[4].ateDirSemana, 36);
  assert.strictEqual(r.meses[4].ateIndSemana, 11);
  // Totales del año
  assert.strictEqual(r.totales.planDir, 1638);
  assert.strictEqual(r.totales.planTotal, 2139);
  assert.strictEqual(r.totales.metaDir, 1467);
  assert.strictEqual(r.totales.metaTotal, 1921);
});

test('Caso 2: PersonaId 71580 · Arica · KINESIOLOGO 44 h → 42 h · 2,25 h de asignaciones', () => {
  const r = calcular(71580, 11);
  // ene-abr con 44 h: 40 atenciones directas por semana; may-dic con 42 h: 38
  assert.strictEqual(r.meses[0].ateDirSemana, 40);
  assert.strictEqual(r.meses[4].ateDirSemana, 38);
  assert.strictEqual(r.meses[4].ateIndSemana, 7);
  // Plan mensual de atenciones directas (ene..jun)
  assert.deepStrictEqual(r.meses.slice(0, 6).map((m) => m.planDir), [159, 0, 176, 168, 144, 159]);
  // Totales del año
  assert.strictEqual(r.totales.planDir, 1648);
  assert.strictEqual(r.totales.planTotal, 1961);
  assert.strictEqual(r.totales.metaDir, 1478);
  assert.strictEqual(r.totales.metaTotal, 1760);
});

test('Validación global: al menos 90% de las filas idénticas al Excel', () => {
  const v = validar();
  const porcentaje = v.iguales / v.total;
  console.log(`   Filas idénticas al Excel: ${v.iguales} de ${v.total} (${(porcentaje * 100).toFixed(1)}%)`);
  assert.ok(porcentaje >= 0.9);
});

test('La Meta de Gestión cambia si cambia el parámetro (nada está fijo en el código)', () => {
  const { cargarParametros } = require('../src/servicios/planificacion');
  const filas = repo.leer('planificacion_base').filter((f) => f.personaId === 71580);
  const con85 = calcularTodo({ filas, parametros: cargarParametros({ generales: { porcentajeMetaGestion: 0.85 } }) })[0];
  assert.ok(con85.totales.metaDir < 1478);
});
