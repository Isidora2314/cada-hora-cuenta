// Fechas como las entrega Blue Prism en un Windows en inglés (M/D/AAAA)
const test = require('node:test');
const assert = require('node:assert');
const { fecha, detectarOrdenFechas, validarBuk } = require('../src/servicios/ingesta');

test('fechas: detecta M/D/AAAA (Blue Prism en inglés) y D/M/AAAA (Chile)', () => {
  detectarOrdenFechas([{ Periodo: '2/1/2026', 'Fecha de Nacimiento': '6/24/1958' }]);
  assert.strictEqual(fecha('2/1/2026'), '2026-02-01');
  assert.strictEqual(fecha('8/1/2026 12:00:00 AM'), '2026-08-01');
  detectarOrdenFechas([{ Periodo: '01/02/2026', 'Fecha de Nacimiento': '24/06/1958' }]);
  assert.strictEqual(fecha('01/02/2026'), '2026-02-01');
  assert.strictEqual(fecha('31-02-2026'), null);
  detectarOrdenFechas([]);
});

test('fechas: un BUK en M/D/AAAA no colapsa los meses', () => {
  const base = { IT: 101, Instituto: 'PMo', PersonaId: 71027, 'Horas Semanales': 32, Cargo: 'ASISTENTE SOCIAL', Cod_Esp: 'AS', 'Fecha de Nacimiento': '6/24/1958' };
  const regs = [1, 2, 3].map((m) => ({ ...base, Periodo: `${m}/1/2026` }));
  const { validos, errores } = validarBuk(regs, { distribucion: [{ cargo: 'ASISTENTE SOCIAL', codEsp: 'AS' }], homologacion: [] });
  assert.deepStrictEqual(validos.map((r) => r.periodo), ['2026-01', '2026-02', '2026-03']);
  assert.strictEqual(errores.filter((e) => e.tipo === 'PERSONA_DUPLICADA').length, 0);
  detectarOrdenFechas([]);
});
