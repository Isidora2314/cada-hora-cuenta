// ------------------------------------------------------------
// INGESTA (etapa 4): lo que llega desde Blue Prism.
//
//  1) normalizarRegistro: acepta los nombres de columna del Excel
//     ("Horas Semanales") o en formato JSON ("horasSemanales").
//  2) validarBuk: detecta errores del reporte (duplicados, horas
//     fuera de rango, fechas inválidas, códigos desconocidos...).
//  3) detectarCambios: compara con la dotación vigente y genera
//     altas, bajas y cambios con su MES DE VIGENCIA.
//  4) aplicarCambio: actualiza dotación y planificación desde
//     esa fecha (no toca los meses anteriores).
// ------------------------------------------------------------

// ---------- 1) Normalización ----------

// "Horas Semanales" -> "horassemanales" ; "horasSemanales" -> "horassemanales"
const clave = (k) => String(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Nombre normalizado -> campo interno
const CAMPOS_BUK = {
  it: 'it', instituto: 'instituto', personaid: 'personaId', area: 'area',
  nombresubarea: 'subArea', subarea: 'subArea', centrodecosto: 'centroCosto', centrocosto: 'centroCosto',
  fechadenacimiento: 'fechaNacimiento', mesnacimiento: 'mesNacimiento', periodo: 'periodo',
  tipodecontrato: 'tipoContrato', tipocontrato: 'tipoContrato',
  fechaingresocompania: 'fechaIngreso', fechaingreso: 'fechaIngreso',
  fechatermino: 'fechaTermino', horassemanales: 'horasSemanales', cargo: 'cargo',
  tipotrabajador: 'tipoTrabajador', diasdelajornada: 'diasJornada', diasjornada: 'diasJornada',
  regsic: 'regSic', codesp: 'codEsp', ndias: 'ndias',
};
const CAMPOS_SIC = {
  personaid: 'personaId', it: 'it', periodo: 'periodo', codesp: 'codEsp',
  atencionesdirectas: 'atencionesDirectas', atencionesindirectas: 'atencionesIndirectas',
};
const OBLIGATORIOS_BUK = ['it', 'personaId', 'periodo', 'horasSemanales', 'cargo', 'codEsp'];

const vacio = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// Convierte cualquier fecha a "AAAA-MM-DD" (o null si no se entiende)
//   Acepta: 2026-08-01 · 01-08-2026 · 01/08/2026 · "01/08/2026 0:00:00" · número de serie de Excel
function fecha(v) {
  if (vacio(v)) return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return armar(m[1], m[2], m[3]);
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return armar(m[3], m[2], m[1]);
  return null;
}
function armar(a, m, d) {
  const anio = Number(a); const mes = Number(m); const dia = Number(d);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null; // ej: 31-02
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
const numero = (v) => {
  if (vacio(v)) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
const texto = (v) => (vacio(v) ? null : String(v).trim());

function mapear(registro, campos) {
  const r = {};
  Object.keys(registro || {}).forEach((k) => {
    const campo = campos[clave(k)];
    if (campo) r[campo] = registro[k];
  });
  return r;
}

function normalizarBuk(original) {
  const r = mapear(original, CAMPOS_BUK);
  const nacimiento = fecha(r.fechaNacimiento);
  const periodo = fecha(r.periodo);
  return {
    it: numero(r.it),
    instituto: texto(r.instituto),
    personaId: numero(r.personaId),
    area: texto(r.area),
    subArea: texto(r.subArea),
    centroCosto: texto(r.centroCosto),
    // Protección de datos: solo se guarda el MES de nacimiento
    mesNacimiento: nacimiento ? Number(nacimiento.slice(5, 7)) : numero(r.mesNacimiento),
    periodo: periodo ? periodo.slice(0, 7) : null,
    tipoContrato: texto(r.tipoContrato),
    fechaIngreso: fecha(r.fechaIngreso),
    fechaTermino: fecha(r.fechaTermino),
    horasSemanales: numero(r.horasSemanales),
    cargo: texto(r.cargo) ? texto(r.cargo).toUpperCase() : null,
    tipoTrabajador: texto(r.tipoTrabajador),
    diasJornada: texto(r.diasJornada),
    regSic: texto(r.regSic),
    codEsp: texto(r.codEsp),
    ndias: numero(r.ndias),
    _crudo: { it: r.it, periodo: r.periodo, horasSemanales: r.horasSemanales },
  };
}

// ---------- 2) Validación del reporte BUK ----------
//   Devuelve { validos, errores, resumen }. Las filas con error NO se cargan.
function validarBuk(registros, { distribucion, homologacion }) {
  const errores = [];
  const validos = [];
  const vistos = new Set();
  const cargos = new Set(distribucion.map((d) => d.cargo));
  const codigos = new Set([...distribucion.map((d) => d.codEsp), ...homologacion.map((h) => h.codEsp)].filter(Boolean));
  let filasVacias = 0;

  // Columnas obligatorias (se revisa en el primer registro con datos)
  const primero = registros.find((r) => r && Object.values(r).some((v) => !vacio(v)));
  if (primero) {
    const presentes = new Set(Object.keys(mapear(primero, CAMPOS_BUK)));
    OBLIGATORIOS_BUK.filter((c) => !presentes.has(c)).forEach((c) => {
      errores.push({ fila: null, columna: c, tipo: 'COLUMNA_FALTANTE', valor: null, mensaje: `Falta la columna "${c}" en el reporte` });
    });
    if (errores.length) return { validos: [], errores, resumen: { recibidos: registros.length, cargados: 0, conError: registros.length, filasVacias: 0 } };
  }

  registros.forEach((original, i) => {
    const fila = i + 1;
    if (!original || Object.values(original).every(vacio)) { filasVacias++; return; }
    const r = normalizarBuk(original);
    const err = (columna, tipo, valor, mensaje) => errores.push({ fila, columna, tipo, valor, mensaje, personaId: r.personaId });

    if (String(r._crudo.it).trim().toUpperCase() === 'IT') { err('IT', 'ENCABEZADO_REPETIDO', r._crudo.it, 'Fila de encabezado repetida dentro de los datos'); return; }
    let conError = false;
    if (!r.personaId) { err('PersonaId', 'DATO_FALTANTE', null, 'Falta el PersonaId'); conError = true; }
    if (!r.it) { err('IT', 'DATO_FALTANTE', r._crudo.it, 'Falta el código de instituto'); conError = true; }
    if (!r.periodo) { err('Periodo', 'FECHA_INVALIDA', r._crudo.periodo, 'El período no es una fecha válida'); conError = true; }
    if (r.horasSemanales === null || r.horasSemanales <= 0 || r.horasSemanales > 45) {
      err('Horas Semanales', 'HORAS_FUERA_RANGO', r._crudo.horasSemanales, 'Las horas semanales deben estar entre 1 y 45'); conError = true;
    }
    if (r.codEsp && !codigos.has(r.codEsp)) { err('Cod_Esp', 'COD_ESP_DESCONOCIDO', r.codEsp, `El código de especialidad "${r.codEsp}" no existe en los parámetros`); conError = true; }
    if (r.cargo && !cargos.has(r.cargo)) { err('Cargo', 'CARGO_SIN_PARAMETRO', r.cargo, `El cargo "${r.cargo}" no tiene % definidos en Distribución por cargo`); conError = true; }

    const llave = `${r.personaId}|${r.it}|${r.periodo}`;
    if (!conError && vistos.has(llave)) { err('PersonaId', 'PERSONA_DUPLICADA', r.personaId, `PersonaId ${r.personaId} aparece dos veces en el instituto ${r.it} para ${r.periodo}`); conError = true; }
    if (conError) return;
    vistos.add(llave);
    delete r._crudo;
    validos.push(r);
  });

  return {
    validos,
    errores,
    resumen: { recibidos: registros.length, cargados: validos.length, conError: registros.length - validos.length - filasVacias, filasVacias },
  };
}

// ---------- 3) Detección de cambios ----------
// Compara el reporte nuevo con la dotación vigente, por persona e instituto.
//   conError: PersonaId con filas rechazadas (no se marcan como baja por eso)
function detectarCambios(dotacionActual, nuevos, cargaId, conError = new Set()) {
  const agrupar = (lista) => {
    const g = {};
    lista.forEach((r) => {
      const k = `${r.personaId}|${r.it}`;
      if (!g[k]) g[k] = [];
      g[k].push(r);
    });
    Object.values(g).forEach((l) => l.sort((a, b) => a.periodo.localeCompare(b.periodo)));
    return g;
  };
  const actual = agrupar(dotacionActual);
  const nuevo = agrupar(nuevos);
  const ultimoPeriodoNuevo = nuevos.reduce((m, r) => (r.periodo > m ? r.periodo : m), '');
  const cambios = [];
  const sinCambios = []; // claves que se pueden actualizar solas (solo agregan meses iguales)

  const crear = (tipo, r, mesVigencia, antes, despues, descripcion) => cambios.push({
    tipo, personaId: r.personaId, it: r.it, instituto: r.instituto, cargo: r.cargo,
    vigencia: mesVigencia, antes, despues, descripcion, cargaId,
  });

  // Altas, jornada, cargo y vigencia
  Object.entries(nuevo).forEach(([k, lista]) => {
    const previos = actual[k];
    const primero = lista[0];
    if (!previos) {
      const tipo = primero.tipoTrabajador === 'Reemplazo' ? 'NUEVO_REEMPLAZO' : 'ALTA';
      crear(tipo, primero, primero.periodo, null,
        { cargo: primero.cargo, horasSemanales: primero.horasSemanales, tipoContrato: primero.tipoContrato, fechaTermino: primero.fechaTermino },
        `${tipo === 'ALTA' ? 'Nuevo profesional' : 'Nuevo reemplazo'}: ${primero.cargo}, ${primero.horasSemanales} h semanales desde ${primero.periodo}`);
      return;
    }
    const porPeriodo = {};
    previos.forEach((r) => { porPeriodo[r.periodo] = r; });
    const anteriorA = (periodo) => [...previos].reverse().find((r) => r.periodo <= periodo) || previos[0];

    let huboCambio = false;
    // Primer mes en que cambian las horas
    const jornada = lista.find((r) => anteriorA(r.periodo).horasSemanales !== r.horasSemanales);
    if (jornada) {
      const antes = anteriorA(jornada.periodo).horasSemanales;
      crear('CAMBIO_JORNADA', jornada, jornada.periodo, { horasSemanales: antes }, { horasSemanales: jornada.horasSemanales },
        `Jornada ${antes > jornada.horasSemanales ? 'baja' : 'sube'} de ${antes} a ${jornada.horasSemanales} h semanales desde ${jornada.periodo}`);
      huboCambio = true;
    }
    const cargo = lista.find((r) => anteriorA(r.periodo).cargo !== r.cargo);
    if (cargo) {
      const antes = anteriorA(cargo.periodo).cargo;
      crear('CAMBIO_CARGO', cargo, cargo.periodo, { cargo: antes, codEsp: anteriorA(cargo.periodo).codEsp }, { cargo: cargo.cargo, codEsp: cargo.codEsp },
        `Cambia de cargo: ${antes} → ${cargo.cargo} desde ${cargo.periodo}`);
      huboCambio = true;
    }
    const vig = lista.find((r) => (anteriorA(r.periodo).fechaTermino || null) !== (r.fechaTermino || null));
    if (vig) {
      const antes = anteriorA(vig.periodo).fechaTermino;
      crear('CAMBIO_VIGENCIA', vig, (vig.fechaTermino || vig.periodo).slice(0, 7), { fechaTermino: antes }, { fechaTermino: vig.fechaTermino },
        vig.fechaTermino ? `El contrato ahora termina el ${vig.fechaTermino}` : 'El contrato ya no tiene fecha de término');
      huboCambio = true;
    }
    if (!huboCambio) sinCambios.push(k);
  });

  // Bajas: estaba en el mes anterior al último del reporte y ya no aparece en el último mes,
  // sin que su contrato dijera que terminaba (si terminaba, no es una sorpresa).
  Object.entries(actual).forEach(([k, previos]) => {
    const enReporte = nuevo[k] || [];
    const ultimoNuevo = enReporte.length ? enReporte[enReporte.length - 1] : null;
    const ultimo = ultimoNuevo || previos[previos.length - 1];
    if (!ultimoPeriodoNuevo || ultimo.periodo >= ultimoPeriodoNuevo) return;
    if (ultimo.periodo < mesAnterior(ultimoPeriodoNuevo)) return; // ya no estaba antes
    if (conError.has(ultimo.personaId)) return;                    // su fila vino con error
    if (ultimo.fechaTermino && ultimo.fechaTermino.slice(0, 7) <= ultimo.periodo) return; // terminaba ese mes
    crear('BAJA', ultimo, ultimoPeriodoNuevo, { cargo: ultimo.cargo, horasSemanales: ultimo.horasSemanales }, null,
      `Ya no aparece en BUK desde ${ultimoPeriodoNuevo} (último mes: ${ultimo.periodo})`);
    const i = sinCambios.indexOf(k);
    if (i >= 0) sinCambios.splice(i, 1);
  });

  return { cambios, sinCambios };
}

function mesAnterior(periodo) {
  const [a, m] = periodo.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

// ---------- 4) Aplicar un cambio ----------
// Modifica copias de dotación y planificación y las devuelve.
//   - Dotación: los registros del reporte nuevo reemplazan a los anteriores DESDE la vigencia.
//   - Planificación: alta -> fila nueva; baja/vigencia -> cierra la fila; cargo -> parte la fila en dos.
function aplicarCambio(cambio, { dotacion, planificacion, reporte, ausenciasEstandar, institutos }) {
  const mes = Number(cambio.vigencia.slice(5, 7));
  const delReporte = reporte.filter((r) => r.personaId === cambio.personaId && r.it === cambio.it);
  const otros = dotacion.filter((r) => !(r.personaId === cambio.personaId && r.it === cambio.it));
  const previos = dotacion.filter((r) => r.personaId === cambio.personaId && r.it === cambio.it && r.periodo < cambio.vigencia);
  const nuevaDotacion = cambio.tipo === 'BAJA'
    ? [...otros, ...previos]
    : [...otros, ...previos, ...delReporte.filter((r) => r.periodo >= cambio.vigencia)];

  let filas = planificacion.map((f) => ({ ...f }));
  const propias = filas.filter((f) => f.personaId === cambio.personaId && f.it === cambio.it);
  const vigenteEn = (m) => propias.find((f) => m >= f.desde && m <= f.hasta) || propias[propias.length - 1];
  const nuevoId = () => Math.max(0, ...filas.map((f) => f.id)) + 1;

  if (cambio.tipo === 'ALTA' || cambio.tipo === 'NUEVO_REEMPLAZO') {
    const r = delReporte[0];
    const hasta = r.fechaTermino && r.fechaTermino.startsWith('2026') ? Number(r.fechaTermino.slice(5, 7)) : 12;
    filas.push({
      id: nuevoId(), personaId: r.personaId, it: r.it,
      instituto: r.instituto || (institutos.find((i) => i.it === r.it) || {}).abreviatura,
      cargo: r.cargo, codEsp: r.codEsp, tipoContrato: r.tipoContrato,
      desde: mes, hasta, excepId: null, vacante: false, licenciaExtensa: false,
      horasColacion: 0, pctGrupalDMN: null, asignaciones: [], ajustes: null,
      // Ausencias típicas (mediana de la dotación) desde el mes de alta
      ausenciasSemanas: ausenciasEstandar.map((a, i) => (i + 1 >= mes ? a : 0)),
      origen: `Alta desde BUK (${cambio.tipoTrabajador || cambio.tipo})`,
    });
  } else if (cambio.tipo === 'BAJA') {
    propias.forEach((f) => {
      const real = filas.find((x) => x.id === f.id);
      if (real.hasta >= mes) real.hasta = Math.max(real.desde - 1, mes - 1);
    });
  } else if (cambio.tipo === 'CAMBIO_VIGENCIA') {
    const termino = cambio.despues.fechaTermino;
    const hasta = termino && termino.startsWith('2026') ? Number(termino.slice(5, 7)) : 12;
    const f = filas.find((x) => x.id === vigenteEn(mes).id);
    f.hasta = Math.max(f.desde - 1, hasta);
  } else if (cambio.tipo === 'CAMBIO_CARGO' || cambio.tipo === 'CAMBIO_JORNADA') {
    // Se PARTE la fila en dos períodos: hasta el mes anterior queda igual
    // (los meses pasados no cambian) y desde la vigencia se calcula con lo nuevo.
    const actual = filas.find((x) => x.id === vigenteEn(mes).id);
    const nuevos = cambio.tipo === 'CAMBIO_CARGO'
      ? { cargo: cambio.despues.cargo, codEsp: cambio.despues.codEsp || actual.codEsp, ajustes: null }
      : {};
    const origen = `${cambio.tipo === 'CAMBIO_CARGO' ? 'Cambio de cargo' : 'Cambio de jornada'} desde BUK (${cambio.vigencia})`;
    if (actual.desde >= mes) {
      Object.assign(actual, nuevos, { origen });
    } else {
      const hastaOriginal = actual.hasta;
      actual.hasta = mes - 1;
      filas.push({ ...actual, ...nuevos, id: nuevoId(), desde: mes, hasta: hastaOriginal, origen });
    }
  }

  return { dotacion: nuevaDotacion, planificacion: filas };
}

// Normaliza un registro del reporte SIC
function normalizarSic(original) {
  const r = mapear(original, CAMPOS_SIC);
  const periodo = fecha(r.periodo);
  return {
    personaId: numero(r.personaId),
    it: numero(r.it),
    periodo: periodo ? periodo.slice(0, 7) : null,
    codEsp: texto(r.codEsp),
    atencionesDirectas: numero(r.atencionesDirectas) || 0,
    atencionesIndirectas: numero(r.atencionesIndirectas) || 0,
  };
}

module.exports = { validarBuk, detectarCambios, aplicarCambio, normalizarSic, normalizarBuk, fecha };
