// ------------------------------------------------------------
// Compara el cálculo del sistema con el Excel actual, fila por fila.
// Uso:  npm run validar
// Genera data/validacion.json con las diferencias.
// ------------------------------------------------------------
const repo = require('../src/repositorio/archivoJson');
const { calcularTodo } = require('../src/servicios/planificacion');

function validar() {
  const resultados = calcularTodo();
  const referencia = repo.leer('referencia_excel');
  const filas = repo.leer('planificacion_base');
  const dotacion = repo.leer('dotacion');

  const diferencias = [];
  let iguales = 0;
  // Solo se comparan las filas que vienen del Excel (las altas nuevas no tienen referencia).
  // Ojo: si ya aplicaste cambios de BUK, esas filas difieren a propósito.
  // Para validar contra el Excel, corre antes "npm run importar".
  resultados.slice(0, referencia.length).forEach((res, i) => {
    const ref = referencia[i];
    const mesesDistintos = [];
    for (let m = 0; m < 12; m++) {
      const mio = res.meses[m] || {};
      if (mio.planDir !== ref.planAteDir[m] || mio.planTotal !== ref.planAteDirInd[m]) {
        mesesDistintos.push({
          mes: m + 1,
          sistema: { dir: mio.planDir, total: mio.planTotal, horas: mio.horasSemanales },
          excel: { dir: ref.planAteDir[m], total: ref.planAteDirInd[m] },
        });
      }
    }
    if (mesesDistintos.length === 0) { iguales++; return; }

    // ¿Por qué difiere? Si BUK trae horas distintas a las que usó el Excel, es un cambio de dotación
    const enBuk = dotacion.filter((d) => d.personaId === ref.personaId && d.it === ref.it);
    const hsBuk = [...new Set(enBuk.map((d) => d.horasSemanales))];
    let motivo = 'Revisar';
    if (filas[i].excepId) motivo = 'Multi-instituto';
    else if (ref.cambioJornada) motivo = `Cambio de jornada (${ref.cambioJornada}) en BUK`;
    else if (enBuk.length === 0) motivo = 'No está en el reporte BUK';

    diferencias.push({
      personaId: ref.personaId, it: ref.it, cargo: ref.cargo,
      motivo, horasBuk: hsBuk,
      totalSistema: res.totales ? res.totales.planDir : null,
      totalExcel: ref.totalPlanDir,
      mesesDistintos,
    });
  });

  return { total: Math.min(resultados.length, referencia.length), iguales, distintas: diferencias.length, diferencias };
}

if (require.main === module) {
  const v = validar();
  repo.guardar('validacion', [v]);
  console.log(`Filas iguales al Excel: ${v.iguales} de ${v.total} (${(100 * v.iguales / v.total).toFixed(1)}%)`);
  const porMotivo = {};
  v.diferencias.forEach((d) => { porMotivo[d.motivo] = (porMotivo[d.motivo] || 0) + 1; });
  console.log('Diferencias por motivo:');
  console.table(porMotivo);
  console.log('Detalle en data/validacion.json');
}

module.exports = { validar };
