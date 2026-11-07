// ------------------------------------------------------------
// Tests de la etapa 4: validación del reporte BUK y detección de cambios.
// Usan datos pequeños inventados (no dependen de la carpeta data).
// ------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert');
const { validarBuk, detectarCambios, aplicarCambio, fecha } = require('../src/servicios/ingesta');

const parametros = {
  distribucion: [{ cargo: 'KINESIOLOGO', codEsp: 'KI' }, { cargo: 'JEFE KINESIOLOGIA', codEsp: 'KI' }],
  homologacion: [{ codEsp: 'KI' }],
};
// Fila con los nombres de columna del Excel de BUK (como la envía Blue Prism)
const fila = (pid, periodo, horas, extra = {}) => ({
  IT: 11, Instituto: 'Ari', PersonaId: pid, Periodo: periodo, 'Horas Semanales': horas,
  Cargo: 'KINESIOLOGO', Cod_Esp: 'KI', 'Tipo de Contrato': 'Indefinido', Tipo_Trabajador: 'Titular',
  'Fecha de Nacimiento': '1990-05-20', ...extra,
});

test('lee fechas en varios formatos y rechaza fechas imposibles', () => {
  assert.strictEqual(fecha('2026-08-01'), '2026-08-01');
  assert.strictEqual(fecha('01-08-2026'), '2026-08-01');
  assert.strictEqual(fecha('01/08/2026 0:00:00'), '2026-08-01');
  assert.strictEqual(fecha(46235), '2026-08-01'); // número de serie de Excel
  assert.strictEqual(fecha('31-02-2026'), null);
});

test('detecta los errores del reporte', () => {
  const { validos, errores } = validarBuk([
    fila(1, '2026-08-01', 42),
    fila(1, '2026-08-01', 42),                       // duplicada
    fila(2, '2026-08-01', 60),                       // horas fuera de rango
    fila(3, '31-02-2026', 42),                       // fecha inválida
    fila(4, '2026-08-01', 42, { Cod_Esp: 'XX' }),    // código desconocido
    fila(5, '2026-08-01', 42, { Cargo: 'ASTRONAUTA' }), // cargo sin parámetros
    {},                                              // fila vacía (se ignora)
    { IT: 'IT', PersonaId: 'PersonaId' },            // encabezado repetido
  ], parametros);
  const tipos = errores.map((e) => e.tipo).sort();
  assert.deepStrictEqual(tipos, ['CARGO_SIN_PARAMETRO', 'COD_ESP_DESCONOCIDO', 'ENCABEZADO_REPETIDO', 'FECHA_INVALIDA', 'HORAS_FUERA_RANGO', 'PERSONA_DUPLICADA']);
  assert.strictEqual(validos.length, 1);
  assert.strictEqual(validos[0].mesNacimiento, 5, 'solo guarda el mes de nacimiento');
  assert.strictEqual(validos[0].fechaNacimiento, undefined);
});

test('avisa si falta una columna obligatoria', () => {
  const { errores, validos } = validarBuk([{ IT: 11, PersonaId: 1, Periodo: '2026-08-01' }], parametros);
  assert.ok(errores.some((e) => e.tipo === 'COLUMNA_FALTANTE'));
  assert.strictEqual(validos.length, 0);
});

test('detecta alta, baja, jornada y cargo con su mes de vigencia', () => {
  const actual = validarBuk([
    fila(10, '2026-07-01', 42), fila(11, '2026-07-01', 42), fila(12, '2026-07-01', 42), fila(13, '2026-07-01', 42),
  ], parametros).validos;
  const nuevo = validarBuk([
    fila(10, '2026-07-01', 42), fila(10, '2026-08-01', 42),                           // sin cambios
    fila(11, '2026-07-01', 42), fila(11, '2026-08-01', 33),                           // jornada
    fila(12, '2026-07-01', 42), fila(12, '2026-08-01', 42, { Cargo: 'JEFE KINESIOLOGIA' }), // cargo
    fila(13, '2026-07-01', 42),                                                       // baja en agosto
    fila(14, '2026-08-01', 40),                                                       // alta
  ], parametros).validos;
  const { cambios, sinCambios } = detectarCambios(actual, nuevo, 1);
  const resumen = cambios.map((c) => `${c.tipo}:${c.personaId}:${c.vigencia}`).sort();
  assert.deepStrictEqual(resumen, ['ALTA:14:2026-08', 'BAJA:13:2026-08', 'CAMBIO_CARGO:12:2026-08', 'CAMBIO_JORNADA:11:2026-08']);
  assert.deepStrictEqual(sinCambios, ['10|11']);
});

test('aplicar un cambio de jornada no modifica los meses anteriores', () => {
  const fila11 = { id: 1, personaId: 11, it: 11, cargo: 'KINESIOLOGO', codEsp: 'KI', desde: 1, hasta: 12, asignaciones: [], ausenciasSemanas: new Array(12).fill(0) };
  const cambio = { tipo: 'CAMBIO_JORNADA', personaId: 11, it: 11, vigencia: '2026-08', despues: { horasSemanales: 33 } };
  const { planificacion } = aplicarCambio(cambio, {
    dotacion: [], planificacion: [fila11], reporte: [], ausenciasEstandar: new Array(12).fill(0), institutos: [],
  });
  assert.deepStrictEqual(planificacion.map((f) => [f.desde, f.hasta]), [[1, 7], [8, 12]]);
});
