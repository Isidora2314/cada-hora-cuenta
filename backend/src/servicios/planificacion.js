// ------------------------------------------------------------
// Une las piezas: lee parámetros, horas de BUK y filas de
// planificación, y llama al motor de cálculo.
// ------------------------------------------------------------
const repo = require('../repositorio/archivoJson');
const { calcularFila } = require('./calculo');

// Carga todos los parámetros. "cambios" permite simular sin guardar:
//   cargarParametros({ generales: { porcentajeMetaGestion: 0.85 } })
function cargarParametros(cambios = {}) {
  const generales = {};
  repo.leer('parametros_generales').forEach((g) => { generales[g.clave] = g.valor; });
  return {
    distribucion: cambios.distribucion || repo.leer('distribucion'),
    factorGrupal: cambios.factorGrupal || repo.leer('factor_grupal'),
    calendario: cambios.calendario || repo.leer('calendario'),
    generales: { ...generales, ...(cambios.generales || {}) },
  };
}

// Horas semanales de cada mes (ene..dic) para una fila de planificación.
//  - Multi-instituto: se usan las horas de la hoja Excepciones para ESE instituto
//  - Resto: horas del reporte BUK; los meses que BUK aún no informa
//    repiten el último valor conocido (salvo que el contrato termine antes)
function horasPorMes(fila, indiceBuk, excepciones) {
  if (fila.excepId) {
    const e = excepciones.find((x) => x.excepId === fila.excepId);
    if (e) return e.horasPorMes;
  }
  const registros = indiceBuk[`${fila.personaId}|${fila.it}`] || {};
  const horas = [];
  let ultimo = null;
  for (let m = 1; m <= 12; m++) {
    const r = registros[m];
    if (r) {
      ultimo = r;
      horas.push(r.horasSemanales || 0);
    } else if (ultimo && m > ultimoMes(registros)) {
      // Mes futuro: sigue igual, salvo que el contrato ya haya terminado
      const termino = ultimo.fechaTermino ? Number(ultimo.fechaTermino.slice(5, 7)) : 12;
      const terminoAnio = ultimo.fechaTermino ? Number(ultimo.fechaTermino.slice(0, 4)) : 2026;
      horas.push(terminoAnio > 2026 || m <= termino ? ultimo.horasSemanales : 0);
    } else {
      horas.push(0);
    }
  }
  return horas;
}

function ultimoMes(registros) {
  return Math.max(0, ...Object.keys(registros).map(Number));
}

// Índice de BUK: "personaId|it" -> { mes: registro }
function indexarBuk(dotacion) {
  const indice = {};
  dotacion.forEach((r) => {
    const clave = `${r.personaId}|${r.it}`;
    if (!indice[clave]) indice[clave] = {};
    indice[clave][Number(r.periodo.slice(5, 7))] = r;
  });
  return indice;
}

// Calcula todas las filas (o las que se pasen) con los parámetros dados
// (se puede pasar otra dotación para calcular "qué pasaría si")
function calcularTodo({ parametros, filas, dotacion } = {}) {
  const p = parametros || cargarParametros();
  const lista = filas || repo.leer('planificacion_base');
  const indiceBuk = indexarBuk(dotacion || repo.leer('dotacion'));
  const excepciones = repo.leer('excepciones');
  return lista.map((fila) => calcularFila(fila, horasPorMes(fila, indiceBuk, excepciones), p));
}

// Ausencias "típicas" por mes (mediana de la dotación con contrato todo el año).
// Se usan para planificar a quien entra nuevo desde BUK.
function ausenciasEstandar(filas) {
  const base = filas.filter((f) => f.desde === 1 && f.hasta === 12 && !f.licenciaExtensa);
  return Array.from({ length: 12 }, (_, m) => {
    const valores = base.map((f) => f.ausenciasSemanas[m]).sort((a, b) => a - b);
    return valores.length ? valores[Math.floor(valores.length / 2)] : 0;
  });
}

// Agrega lo REALIZADO según SIC a cada mes calculado (m.realizado) y devuelve
// los meses que ya tienen datos de SIC (para comparar solo meses cerrados).
function agregarRealizado(resultados) {
  const realizado = repo.leer('realizado');
  const indice = {};
  const mesesConDatos = new Set();
  realizado.forEach((r) => {
    const m = Number(r.periodo.slice(5, 7));
    mesesConDatos.add(m);
    const k = `${r.personaId}|${r.it}|${m}`;
    indice[k] = (indice[k] || 0) + r.atencionesDirectas + r.atencionesIndirectas;
  });
  resultados.forEach((r) => {
    (r.meses || []).forEach((x) => {
      const dentro = x.mes >= r.desde && x.mes <= r.hasta;
      x.realizado = dentro && mesesConDatos.has(x.mes) ? (indice[`${r.personaId}|${r.it}|${x.mes}`] || 0) : null;
    });
  });
  return [...mesesConDatos].sort((a, b) => a - b);
}

module.exports = { cargarParametros, calcularTodo, horasPorMes, indexarBuk, ausenciasEstandar, agregarRealizado };
