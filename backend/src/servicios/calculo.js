// ------------------------------------------------------------
// MOTOR DE CÁLCULO (etapa 3)
//
// Calcula, para cada fila de planificación (profesional + instituto +
// período de jornada) y para cada mes:
//   horas contratadas, NAS, asignaciones, horas disponibles,
//   atenciones directas/indirectas, Meta de Gestión y % FOJA.
//
// Todas las reglas salen de los PARÁMETROS (nada fijo en el código).
// Las fórmulas se validaron contra el Excel actual (npm run validar).
// ------------------------------------------------------------

const EPS = 1e-6; // evita errores de decimales al redondear hacia abajo (ej: 137,99999 -> 138)
const piso = (x) => Math.floor(x + EPS);

// Tramo de jornada según el promedio ponderado de horas semanales
function tramoDe(horas) {
  if (horas >= 40) return 'mayorIgual40';
  if (horas >= 22) return 'entre22y40';
  return 'menor22';
}

// Promedio ponderado de horas semanales del período, truncado (como el Excel).
// Si en ene-abr tiene la jornada legal completa (44 h), cuenta como 42 h:
// la baja legal de jornada NO es un cambio de jornada del profesional.
function promedioPonderado(horasMes, desde, hasta, calendario, generales) {
  let suma = 0;
  let pesos = 0;
  for (let m = desde; m <= hasta; m++) {
    let h = horasMes[m - 1];
    if (!h) continue;
    if (m <= 4 && h === generales.jornadaLegalEneAbr) h = generales.jornadaLegalMayDic;
    const semanas = calendario[m - 1].semanasHabiles;
    suma += h * semanas;
    pesos += semanas;
  }
  return pesos ? Math.trunc(suma / pesos + EPS) : 0;
}

// ¿Cuántos pacientes por grupo según instituto? (Santiago y Concepción tienen otro valor)
function pacientesPorGrupo(factor, it, generales) {
  return generales.institutosGrupoGrande.includes(it) ? factor.pacientesSanCon : factor.pacientesOtrosIT;
}

/**
 * Calcula una fila de planificación.
 * @param fila      fila de planificación (ver data/planificacion_base.json)
 * @param horasMes  arreglo de 12 números: horas semanales de BUK por mes
 * @param p         parámetros { distribucion, factorGrupal, calendario, generales, catalogo }
 */
function calcularFila(fila, horasMes, p) {
  const alertas = [];
  const { generales, calendario } = p;

  // 1) Parámetros del cargo
  const dist = p.distribucion.find((d) => d.cargo === fila.cargo);
  if (!dist) {
    return { ...identificacion(fila), error: `El cargo "${fila.cargo}" no tiene parámetros`, meses: [], totales: null, alertas };
  }

  // 2) Promedio ponderado, tramo y porcentajes
  const promPond = promedioPonderado(horasMes, fila.desde, fila.hasta, calendario, generales);
  const tramo = tramoDe(promPond);
  // Si la fila tiene ajustes propios (definidos por planificación), mandan sobre la tabla del cargo
  const pct = (fila.ajustes && fila.ajustes.pctDir !== undefined)
    ? { dir: fila.ajustes.pctDir, ind: fila.ajustes.pctInd, nas: fila.ajustes.pctNas }
    : dist.tramos[tramo];
  const pctDir = pct.dir;
  const pctInd = pct.ind || 0;
  const pctNas = pct.nas;

  // 3) Horas fijas por semana: NAS y asignaciones especiales
  const horasNas = promPond * pctNas;
  const asignacionesValidas = fila.asignaciones.filter(
    (a) => !a.requiereDMN || a.estado === 'APROBADA', // las que requieren DMN solo cuentan si fueron aprobadas
  );
  const horasAsig = asignacionesValidas.reduce((s, a) => s + (a.horas || 0), 0);
  const regulares = asignacionesValidas.filter((a) => a.tipo === 'regular').length;
  if (promPond > 30 && regulares > generales.maxAsignacionesSobre30h) {
    alertas.push(`Tiene ${regulares} asignaciones (máximo ${generales.maxAsignacionesSobre30h} con más de 30 h)`);
  }

  // 4) Atención grupal (solo algunas áreas)
  const factor = p.factorGrupal.find((f) => f.codEsp === fila.codEsp);
  const pctGrupal = fila.pctGrupalDMN ?? (factor ? factor.porcentajeGrupal : 0);
  const pacientes = factor ? pacientesPorGrupo(factor, fila.it, generales) : 0;

  const stdDir = (fila.ajustes && fila.ajustes.stdMinutosDirecta) || dist.stdMinutosDirecta;
  const stdInd = dist.stdMinutosIndirecta || generales.stdMinutosIndirecta;

  // 5) Cálculo mes a mes
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const semanasMes = calendario[m - 1].semanasHabiles;
    const vigente = m >= fila.desde && m <= fila.hasta;
    const hs = vigente ? (horasMes[m - 1] || 0) : 0;
    // Horas disponibles antes de NAS = horas contratadas - colación del contrato
    const hd = hs > 0 ? hs - (fila.horasColacion || 0) : 0;
    // Semanas hábiles del profesional = semanas del mes - ausencias (licencias, vacaciones, permisos, otros)
    const semanas = vigente && hs > 0
      ? Math.max(0, semanasMes - (fila.ausenciasSemanas[m - 1] || 0))
      : 0;

    let pctAsistencial = 0;
    let pctDirFinal = 0;
    let pctIndFinal = 0;
    let ateDirSem = 0;
    let ateIndSem = 0;
    if (hd > 0) {
      // Lo que queda después de NAS y asignaciones se reparte proporcional entre directa e indirecta
      pctAsistencial = Math.max(0, 1 - (horasNas + horasAsig) / hd);
      pctDirFinal = pctAsistencial * pctDir / (pctDir + pctInd);
      pctIndFinal = pctAsistencial * pctInd / (pctDir + pctInd);
      ateDirSem = piso(hd * pctDirFinal * 60 / stdDir);
      ateIndSem = piso(hd * pctIndFinal * 60 / stdInd);
    }
    // Directa + grupal: la parte grupal se multiplica por los pacientes del grupo
    const ateDirGrupalSem = ateDirSem * (1 - pctGrupal) + ateDirSem * pctGrupal * pacientes;

    const planDir = piso(ateDirGrupalSem * semanas);
    const planDirInd = piso((ateDirGrupalSem + ateIndSem) * semanas);
    const horasContratadas = hs * semanasMes;
    const horasDirectas = hd * pctDirFinal * semanas;

    meses.push({
      mes: m,
      horasSemanales: hs,
      semanasHabiles: redondear(semanas, 3),
      pctAsistencial: redondear(pctAsistencial, 4),
      pctDirFinal: redondear(pctDirFinal, 4),
      pctIndFinal: redondear(pctIndFinal, 4),
      ateDirSemana: redondear(ateDirGrupalSem, 2),
      ateIndSemana: ateIndSem,
      horasContratadas: redondear(horasContratadas, 1),
      horasDisponibles: redondear(hd * pctAsistencial * semanas, 1),
      horasDirectas: redondear(horasDirectas, 1),
      planDir,
      planInd: planDirInd - planDir,
      planTotal: planDirInd,
      metaDir: piso(planDir * generales.porcentajeMetaGestion),
      metaTotal: piso(planDirInd * generales.porcentajeMetaGestion),
      foja: horasContratadas > 0 ? redondear(horasDirectas / horasContratadas, 4) : null,
    });
  }

  // 6) Totales del año
  const sumar = (campo) => meses.reduce((s, x) => s + x[campo], 0);
  const horasContratadas = sumar('horasContratadas');
  const totales = {
    planDir: sumar('planDir'),
    planInd: sumar('planInd'),
    planTotal: sumar('planTotal'),
    metaDir: sumar('metaDir'),
    metaTotal: sumar('metaTotal'),
    horasContratadas: redondear(horasContratadas, 1),
    horasDirectas: redondear(sumar('horasDirectas'), 1),
    foja: horasContratadas > 0 ? redondear(sumar('horasDirectas') / horasContratadas, 4) : null,
  };

  if (fila.licenciaExtensa) alertas.push('Licencia extensa');

  return {
    ...identificacion(fila),
    detalle: {
      promedioPonderado: promPond,
      tramo,
      pctDir, pctInd, pctNas,
      horasNas: redondear(horasNas, 2),
      horasAsignaciones: horasAsig,
      horasColacion: fila.horasColacion || 0,
      stdMinutosDirecta: stdDir,
      stdMinutosIndirecta: stdInd,
      pctGrupal,
      pacientesPorGrupo: pctGrupal ? pacientes : null,
    },
    meses,
    totales,
    alertas,
  };
}

function identificacion(fila) {
  return {
    filaId: fila.id,
    personaId: fila.personaId,
    it: fila.it,
    instituto: fila.instituto,
    cargo: fila.cargo,
    codEsp: fila.codEsp,
    desde: fila.desde,
    hasta: fila.hasta,
  };
}

function redondear(x, decimales) {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

module.exports = { calcularFila, tramoDe, promedioPonderado };
