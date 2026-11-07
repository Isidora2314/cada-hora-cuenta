// ------------------------------------------------------------
// ETAPA 1 - Script de importación
//
// Lee los 2 Excel del kit y genera los JSON iniciales en /backend/data:
//   - Parámetros reales (desde "Nac - Planificacion Asistencial x mes.xlsx")
//   - Dotación inicial (desde "Nac - Base contratos x mes.xlsx", reporte BUK)
//   - Resultados del Excel actual, para comparar nuestro cálculo (tests)
//
// Uso:  npm run importar
//
// IMPORTANTE: en producción la dotación la envía Blue Prism por la API.
// Aquí la importamos solo para tener datos con que desarrollar.
// ------------------------------------------------------------
const path = require('path');
const XLSX = require('xlsx');
const repo = require('../src/repositorio/archivoJson');

const CARPETA_EXCEL = path.join(__dirname, '..', 'excel');
const ARCHIVO_PLANIFICACION = path.join(CARPETA_EXCEL, 'Nac - Planificacion Asistencial x mes.xlsx');
const ARCHIVO_BUK = path.join(CARPETA_EXCEL, 'Nac - Base contratos x mes.xlsx');

// ============ Funciones de ayuda ============

// Convierte una letra de columna de Excel en índice (A -> 0, B -> 1, AA -> 26)
function col(letra) {
  let n = 0;
  for (const c of letra) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Lee una hoja como una matriz de filas (fila 0 = fila 1 de Excel)
function leerHoja(libro, nombreHoja) {
  const hoja = libro.Sheets[nombreHoja];
  if (!hoja) throw new Error(`No se encontró la hoja "${nombreHoja}"`);
  return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, raw: true });
}

// ¿La celda está vacía?
function vacio(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

// Texto limpio o null
function texto(v) {
  return vacio(v) ? null : String(v).trim();
}

// Número o null
function numero(v) {
  if (vacio(v)) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Convierte una fecha de Excel (número de serie) en texto "AAAA-MM-DD"
function fecha(v) {
  if (vacio(v)) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return String(v).trim(); // si ya viene como texto, se deja igual
}

// Toma 12 columnas seguidas (ene..dic) desde un índice inicial
function doceMeses(fila, inicio) {
  const meses = [];
  for (let i = 0; i < 12; i++) meses.push(numero(fila[inicio + i]) ?? 0);
  return meses;
}

// ============ 1) Parámetros desde el Excel de planificación ============

console.log('Leyendo Excel de planificación...');
const libroPlan = XLSX.readFile(ARCHIVO_PLANIFICACION);

// ---- Hoja "Parámetros" ----
const param = leerHoja(libroPlan, 'Parámetros');

// 1a. Homologación Cod_Esp <-> Cargo <-> Centro de costo (columnas A:D, desde fila 2)
const homologacion = [];
for (let f = 1; f < param.length; f++) {
  const fila = param[f];
  if (vacio(fila[col('B')])) continue;
  homologacion.push({
    codEsp: texto(fila[col('A')]),
    cargo: texto(fila[col('B')]),
    centroCosto: texto(fila[col('C')]),
    descripcionCentroCosto: texto(fila[col('D')]),
  });
}

// 1b. Factor grupal (bloque F4:I8): % grupal y pacientes por grupo
const factorGrupal = [];
for (let f = 3; f <= 7; f++) {
  const fila = param[f];
  if (numero(fila[col('G')]) === null) continue;
  factorGrupal.push({
    codEsp: texto(fila[col('F')]),
    porcentajeGrupal: numero(fila[col('G')]),
    pacientesSanCon: numero(fila[col('H')]),   // Santiago y Concepción
    pacientesOtrosIT: numero(fila[col('I')]),  // resto de institutos
  });
}

// 1c. Calendario por mes (bloque X3:AD14)
const calendario = [];
for (let f = 2; f <= 13; f++) {
  const fila = param[f];
  calendario.push({
    mes: f - 1, // 1 = enero ... 12 = diciembre
    nombre: texto(fila[col('X')]),
    diasHabiles: numero(fila[col('Y')]),
    diasHabilesConVacaciones: numero(fila[col('Z')]),
    semanasHabiles: numero(fila[col('AD')]), // ej: ene 4,2 / feb 4 / mar 4,4
  });
}

// 1d. Institutos (bloque AM:AO). Se omiten las filas "(G)" y los repetidos.
const institutos = [];
const zonas = { Ari: 'Arica', Nub: 'Ñuble', Coy: 'Aysén' }; // zonas con reglas propias
for (let f = 1; f < param.length; f++) {
  const fila = param[f];
  const it = numero(fila[col('AM')]);
  const nombre = texto(fila[col('AO')]);
  if (it === null || !nombre || nombre.includes('(G)')) continue;
  if (institutos.some((i) => i.it === it)) continue;
  const abrev = texto(fila[col('AN')]);
  institutos.push({ it, abreviatura: abrev, nombre, zona: zonas[abrev] || 'Nacional' });
}

// 1e. Parámetros generales (valores sueltos de la hoja)
const parametrosGenerales = [
  { clave: 'porcentajeMetaGestion', valor: 0.9, descripcion: 'Meta de Gestión = atenciones planificadas x este %' },
  { clave: 'jornadaLegalEneAbr', valor: 44, descripcion: 'Jornada legal hasta abril 2026' },
  { clave: 'jornadaLegalMayDic', valor: 42, descripcion: 'Jornada legal desde mayo 2026' },
  { clave: 'maxAsignacionesSobre30h', valor: 2, descripcion: 'Máximo de asignaciones si trabaja más de 30 h/sem' },
  { clave: 'stdMinutosIndirecta', valor: 30, descripcion: 'Minutos estándar de una atención indirecta' },
  { clave: 'institutosGrupoGrande', valor: [131, 81], descripcion: 'IT con más pacientes por grupo (Santiago y Concepción)' },
  { clave: 'umbralAlertaDesviacion', valor: 0.1, descripcion: 'Alerta si lo realizado (SIC) se aleja más de este % de la meta' },
  { clave: 'diasHabilesAnio', valor: numero(param[21][col('AC')]), descripcion: 'Días hábiles 2026' },
  { clave: 'diasVacaciones', valor: numero(param[25][col('AC')]), descripcion: 'Días de vacaciones legales' },
  { clave: 'diasAdministrativos', valor: numero(param[26][col('AC')]), descripcion: 'Administrativos y 1/2 jornada equipo' },
  { clave: 'diaCumpleanios', valor: numero(param[27][col('AC')]), descripcion: 'Día libre por cumpleaños' },
];

// ---- Hoja "Distribucion_NAC": % por cargo y tramo + minutos estándar ----
const distNac = leerHoja(libroPlan, 'Distribucion_NAC');
const distribucion = [];
for (let f = 6; f < distNac.length; f++) {
  const fila = distNac[f];
  // La tabla principal termina en la primera fila vacía
  if (vacio(fila[col('B')])) break;
  const tramo = (inicio) => ({
    dir: numero(fila[inicio]) ?? 0,
    ind: numero(fila[inicio + 1]) ?? 0,
    nas: numero(fila[inicio + 2]) ?? 0,
  });
  distribucion.push({
    codEsp: texto(fila[col('A')]),
    cargo: texto(fila[col('B')]),
    unidad: texto(fila[col('C')]),
    stdMinutosDirecta: numero(fila[col('D')]),
    stdMinutosIndirecta: numero(fila[col('E')]),
    tramos: {
      mayorIgual40: tramo(col('F')), // >= 40 h
      entre22y40: tramo(col('I')),   // 22 a 40 h
      menor22: tramo(col('L')),      // < 22 h
    },
  });
}

// ---- Hoja "Dotacion_Asistencial": resultados del Excel actual ----
const dotAsis = leerHoja(libroPlan, 'Dotacion_Asistencial');
const enc = dotAsis[3]; // encabezados en la fila 4
// Busca la columna cuyo encabezado EMPIEZA con el texto dado
const idx = (nombre) => enc.findIndex((h) => h && String(h).trim().startsWith(nombre));
// Busca la columna cuyo encabezado es EXACTAMENTE el texto dado
const idxExacto = (nombre) => enc.findIndex((h) => h && String(h).trim() === nombre);

const referenciaExcel = [];
for (let f = 4; f < dotAsis.length; f++) {
  const fila = dotAsis[f];
  if (vacio(fila[idx('PersonaId')]) && vacio(fila[idx('Cargo')])) continue;
  referenciaExcel.push({
    it: numero(fila[idx('IT')]),
    instituto: texto(fila[idx('Instituto')]),
    personaId: numero(fila[idx('PersonaId')]), // vacío = vacante
    vacanteNuevo: texto(fila[idx('Vacante/Nuevo')]),
    excepcion: texto(fila[idx('Excepción')]),
    cargo: texto(fila[idx('Cargo')]),
    codEsp: texto(fila[idx('Area')]),
    tipoContrato: texto(fila[idx('Tipo de Contrato')]),
    tipoCargo: texto(fila[idx('Tipo Cargo')]),
    licenciaExtensa: texto(fila[idx('Licencia Extensa')]),
    hsDic: numero(fila[idx('H/S dic')]),
    promPondHorasSemanales: numero(fila[idx('Prom_Pond')]),
    cambioJornada: texto(fila[idx('Cambio jornada')]),
    inicioJornada: fecha(fila[idx('Periodo Inicio Jornada')]),
    finJornada: fecha(fila[idx('Perido Fin Jornada')]),
    diasSemanaContrato: numero(fila[idx('N° Días Semana Contrato')]),
    colacionEnContrato: texto(fila[idx('Colación en Contrato')]),
    horasColacionContrato: numero(fila[idx('Horas Colación en Contrato')]),
    hsDisponibleAntesNas: numero(fila[idx('H/Sem Disponible antes NAS')]),
    nasPausaSaludable: numero(fila[idx('H/Sem Pausa Saludable')]),
    nasColacion: numero(fila[idx('H/Sem Beneficio Colación')]),
    nasOtras: numero(fila[idx('H/Sem Otras NAS')]),
    nasTotal: numero(fila[idx('H/Sem NAS Total')]),
    pctNas: numero(fila[idx('% NAS')]),
    pctDir: numero(fila[idx('%Directo')]),
    pctInd: numero(fila[idx('%Indirecto')]),
    asignacion1: texto(fila[idx('Asignación 1')]),
    hrsAsignacion1: numero(fila[idx('Hrs. Asignación 1')]),
    asignacion2: texto(fila[idx('Asignación 2')]),
    hrsAsignacion2: numero(fila[idx('Hrs. Asignación 2')]),
    asignacionPorAutorizar: texto(fila[idx('Por Autorizar DMN')]),
    hrsAsignacion3: numero(fila[idx('Hrs. Asignación 3')]),
    hrsAsignacion4: numero(fila[idx('Hrs. Asignación 4')]),
    totalHrsAsignacion: numero(fila[idx('Total Hrs. Asignación')]),
    pctNasMasAsig: numero(fila[idx('%NAS + Asig')]),
    pctAsistencial: numero(fila[idx('% Asistencial')]),
    pctDirFinal: numero(fila[idx('%Directo Final')]),
    pctIndFinal: numero(fila[idx('%Indirecto Final')]),
    stdMinutosDirecta: numero(fila[idx('Estándar Minutos Atención Directa')]),
    stdMinutosIndirecta: numero(fila[idx('Estándar Minutos Atención Indirecta')]),
    ateDirectasSemana: numero(fila[idx('N° Ate Directas')]),
    ateIndirectasSemana: numero(fila[idx('N° Ate Indirectas')]),
    pctGrupal: numero(fila[idx('% Atención Grupal')]),
    cambioGrupalDMN: numero(fila[idx('Cambio %Ate. Grupal')]),
    pacientesPorGrupo: numero(fila[idx('N° Pacientes por Grupo')]),
    ateSemanalDirectaGrupal: numero(fila[idx('Atención Semanal Directa + Grupal')]),
    ateSemanalIndirectaTotal: numero(fila[idx('Atención Semanal Indirecta Total')]),
    semanasLicencia: doceMeses(fila, idx('Lic1')),
    semanasVacaciones: doceMeses(fila, idx('Vac1')),
    semanasPermisos: doceMeses(fila, idx('Perm1')),
    semanasHabiles: doceMeses(fila, idx('SemHab1')),
    planAteDir: doceMeses(fila, idx('PlanAteDir1')),
    planAteDirInd: doceMeses(fila, idx('PlanAteDir+Ind1')),
    mgAteDir: doceMeses(fila, idx('MG_AteDir1')),
    mgAteDirInd: doceMeses(fila, idx('MG_AteDir+Ind1')),
    totalPlanDir: numero(fila[idx('Total Plan Atenciones Directas')]),
    totalPlanDirInd: numero(fila[idx('Total Atenciones Dir+Indir')]),
    totalMgDir: numero(fila[idxExacto('Total MG Directa')]),
    totalMg: numero(fila[idxExacto('Total MG')]),
  });
}

// ---- Catálogo de asignaciones especiales (Distribucion_NAC, columnas R:T) ----
const asignaciones = [];
for (let f = 6; f < distNac.length; f++) {
  const fila = distNac[f];
  const nombre = texto(fila[col('R')]);
  if (!nombre || asignaciones.some((a) => a.nombre === nombre)) continue;
  const descripcion = texto(fila[col('T')]);
  const horas = numero(fila[col('S')]);
  asignaciones.push({
    id: asignaciones.length + 1,
    nombre,
    horasSemanales: horas,
    origenHoras: horas === null ? null : 'tabla', // 'tabla' o 'dotacion' (revisar)
    descripcion,
    requiereAutorizacionDMN: /autoriz/i.test(descripcion || ''),
  });
}
// Completa el catálogo con las asignaciones que aparecen en la dotación
// (algunas no tienen horas en la tabla: se toman de la planilla)
const usadasPorAutorizar = new Set();
referenciaExcel.forEach((p) => {
  const pares = [
    [p.asignacion1, p.hrsAsignacion1],
    [p.asignacion2, p.hrsAsignacion2],
    [p.asignacionPorAutorizar, p.hrsAsignacion3],
  ];
  if (p.asignacionPorAutorizar) usadasPorAutorizar.add(p.asignacionPorAutorizar);
  pares.forEach(([nombre, horas]) => {
    if (!nombre) return;
    let a = asignaciones.find((x) => x.nombre.trim() === nombre.trim());
    if (!a) {
      a = { id: asignaciones.length + 1, nombre, horasSemanales: null, origenHoras: null, descripcion: 'Detectada en la dotación', requiereAutorizacionDMN: false };
      asignaciones.push(a);
    }
    // Si la tabla no trae horas, usamos las de la planilla (el planificador debe revisarlas)
    if (a.horasSemanales === null && horas) {
      a.horasSemanales = horas;
      a.origenHoras = 'dotacion';
    }
  });
});
// Las que el Excel pone en la columna "Por Autorizar DMN y VP" requieren DMN
asignaciones.forEach((a) => {
  if (usadasPorAutorizar.has(a.nombre)) a.requiereAutorizacionDMN = true;
});

// ---- Hoja "Excepciones": profesionales multi-instituto ----
const excHoja = leerHoja(libroPlan, 'Excepciones');
const excepciones = [];
for (let f = 2; f < excHoja.length; f++) {
  const fila = excHoja[f];
  if (numero(fila[col('E')]) === null) continue;
  excepciones.push({
    excepId: texto(fila[col('D')]),
    it: numero(fila[col('C')]),
    instituto: texto(fila[col('B')]),
    personaId: numero(fila[col('E')]),
    cargo: texto(fila[col('F')]),
    centroCosto: texto(fila[col('G')]),
    fechaIngreso: fecha(fila[col('H')]),
    horasPorMes: doceMeses(fila, col('K')), // horas semanales en ESTE instituto, ene..dic
    diasSemana: numero(fila[col('W')]),
  });
}

// ---- Filas de planificación (lo que el planificador mantiene) ----
// Cada fila = un profesional en un instituto durante un período de jornada.
// Las HORAS no se guardan aquí: salen de BUK (dotacion.json) o de Excepciones.
// Aquí van los datos que define planificación: asignaciones, colación y ausencias.
const mesDe = (f, porDefecto) => (f ? Number(String(f).slice(5, 7)) : porDefecto);
const planificacionBase = referenciaExcel.map((r, i) => {
  const desde = mesDe(r.inicioJornada, 1);
  const hasta = mesDe(r.finJornada, 12);

  const asignacionesFila = [];
  if (r.asignacion1) asignacionesFila.push({ nombre: r.asignacion1, horas: r.hrsAsignacion1 || 0, tipo: 'regular', requiereDMN: false, estado: 'VIGENTE' });
  if (r.asignacion2) asignacionesFila.push({ nombre: r.asignacion2, horas: r.hrsAsignacion2 || 0, tipo: 'regular', requiereDMN: false, estado: 'VIGENTE' });
  if (r.asignacionPorAutorizar || r.hrsAsignacion3) asignacionesFila.push({ nombre: r.asignacionPorAutorizar || 'Asignación por autorizar (sin nombre)', horas: r.hrsAsignacion3 || 0, tipo: 'porAutorizar', requiereDMN: true, estado: 'APROBADA' });
  if (r.hrsAsignacion4) asignacionesFila.push({ nombre: 'Asignación adicional', horas: r.hrsAsignacion4, tipo: 'adicional', requiereDMN: false, estado: 'VIGENTE' });

  // Ajustes propios de esta fila: cuando el Excel usa % o minutos distintos
  // a la tabla del cargo (ej: un terapeuta con rol de coordinación)
  const d = distribucion.find((x) => x.cargo === r.cargo);
  const tramo = d ? d.tramos[r.promPondHorasSemanales >= 40 ? 'mayorIgual40' : r.promPondHorasSemanales >= 22 ? 'entre22y40' : 'menor22'] : null;
  const distinto = (a, b) => a !== null && b !== null && Math.abs((a || 0) - (b || 0)) > 1e-9;
  const ajustes = {};
  if (tramo && r.pctDir !== null && (distinto(r.pctDir, tramo.dir) || distinto(r.pctInd, tramo.ind) || distinto(r.pctNas, tramo.nas))) {
    ajustes.pctDir = r.pctDir;
    ajustes.pctInd = r.pctInd || 0;
    ajustes.pctNas = r.pctNas;
  }
  if (d && r.stdMinutosDirecta && r.stdMinutosDirecta !== d.stdMinutosDirecta) ajustes.stdMinutosDirecta = r.stdMinutosDirecta;

  // Ausencias en semanas por mes (licencias, vacaciones, permisos, cumpleaños,
  // vísperas, días administrativos, etc.) = semanas del mes - semanas hábiles del Excel
  const ausenciasSemanas = calendario.map((c, m) => {
    if (m + 1 < desde || m + 1 > hasta) return 0;
    return Math.max(0, c.semanasHabiles - r.semanasHabiles[m]);
  });

  return {
    id: i + 1,
    personaId: r.personaId,
    it: r.it,
    instituto: r.instituto,
    cargo: r.cargo,
    codEsp: r.codEsp,
    tipoContrato: r.tipoContrato,
    desde,
    hasta,
    excepId: r.excepcion,                   // multi-instituto (hoja Excepciones)
    vacante: Boolean(r.vacanteNuevo),
    licenciaExtensa: r.licenciaExtensa === 'Si',
    horasColacion: r.horasColacionContrato || 0,
    pctGrupalDMN: r.cambioGrupalDMN,         // % grupal distinto autorizado por DMN
    asignaciones: asignacionesFila,
    ajustes: Object.keys(ajustes).length ? ajustes : null, // % o minutos propios de la fila
    ausenciasSemanas,
  };
});

// ============ 2) Dotación inicial desde el reporte BUK ============

console.log('Leyendo reporte BUK...');
const libroBuk = XLSX.readFile(ARCHIVO_BUK);
const buk = leerHoja(libroBuk, libroBuk.SheetNames[0]);
const encBuk = buk[1].map((h) => texto(h)); // encabezados en la FILA 2
const b = (nombre) => encBuk.indexOf(nombre);

const dotacion = [];
const avisos = { filasVacias: 0, encabezadosRepetidos: 0 };
for (let f = 2; f < buk.length; f++) {
  const fila = buk[f];
  if (fila.every(vacio)) { avisos.filasVacias++; continue; }
  if (fila[b('IT')] === 'IT') { avisos.encabezadosRepetidos++; continue; }

  const nacimiento = fecha(fila[b('Fecha de Nacimiento')]);
  dotacion.push({
    it: numero(fila[b('IT')]),
    instituto: texto(fila[b('Instituto')]),
    personaId: numero(fila[b('PersonaId')]),
    area: texto(fila[b('Área')]),
    subArea: texto(fila[b('Nombre Sub-área')]),
    centroCosto: texto(fila[b('Centro de Costo')]),
    // Protección de datos: solo guardamos el MES de nacimiento (día libre de cumpleaños)
    mesNacimiento: nacimiento ? Number(nacimiento.slice(5, 7)) : null,
    periodo: (fecha(fila[b('Periodo')]) || '').slice(0, 7), // "2026-01"
    tipoContrato: texto(fila[b('Tipo de Contrato')]),
    fechaIngreso: fecha(fila[b('Fecha Ingreso Compañía')]),
    fechaTermino: fecha(fila[b('Fecha Término')]),
    horasSemanales: numero(fila[b('Horas Semanales')]),
    cargo: texto(fila[b('Cargo')]),
    tipoTrabajador: texto(fila[b('Tipo_Trabajador')]),
    diasJornada: texto(fila[b('Días de la Jornada')]),
    regSic: texto(fila[b('Reg_SIC')]),
    codEsp: texto(fila[b('Cod_Esp')]),
    ndias: numero(fila[b('Ndias')]),
  });
}

// ============ 3) Guardar todo ============

repo.guardar('homologacion', homologacion);
repo.guardar('factor_grupal', factorGrupal);
repo.guardar('calendario', calendario);
repo.guardar('institutos', institutos);
repo.guardar('parametros_generales', parametrosGenerales);
repo.guardar('distribucion', distribucion);
repo.guardar('asignaciones_catalogo', asignaciones);
repo.guardar('excepciones', excepciones);
repo.guardar('referencia_excel', referenciaExcel);
repo.guardar('planificacion_base', planificacionBase);
repo.guardar('dotacion', dotacion);

// Deja en blanco lo que se genera usando el sistema (así "importar" sirve para reiniciar la demo)
['cambios', 'cargas', 'errores_carga', 'realizado', 'auditoria', 'validacion'].forEach((t) => repo.guardar(t, []));

console.log('\nImportación terminada. Registros generados:');
console.table({
  institutos: institutos.length,
  homologacion: homologacion.length,
  distribucion: distribucion.length,
  asignaciones_catalogo: asignaciones.length,
  factor_grupal: factorGrupal.length,
  calendario: calendario.length,
  parametros_generales: parametrosGenerales.length,
  excepciones: excepciones.length,
  referencia_excel: referenciaExcel.length,
  planificacion_base: planificacionBase.length,
  dotacion: dotacion.length,
});
console.log('Avisos del reporte BUK:', avisos);
