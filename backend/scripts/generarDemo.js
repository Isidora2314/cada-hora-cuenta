// ------------------------------------------------------------
// Genera los reportes de DEMO (datos ficticios) en backend/excel/demo:
//
//  1) BUK_Agosto_2026_demo.xlsx: el reporte BUK del kit + el mes de agosto,
//     con cambios para mostrar en la demo y errores para que el bot los detecte:
//       - Alta:            PersonaId 150001, Kinesiólogo en Arica (42 h, plazo fijo)
//       - Nuevo reemplazo: PersonaId 150002, Terapeuta ocupacional en Santiago
//       - Cambio jornada:  PersonaId 71580 (Arica) baja de 42 a 33 h
//       - Cambio cargo:    PersonaId 71279 (Santiago) pasa a JEFE KINESIOLOGIA
//       - Cambio vigencia: PersonaId 72414 (Arica) termina el 30-09-2026
//       - Baja:            PersonaId 71960 (Concepción) ya no aparece en agosto
//       - Errores: fila duplicada, horas = 60, fecha 31-02-2026, Cod_Esp "XX",
//         fila vacía y encabezado repetido
//
//  2) SIC_Ene_Jul_2026_demo.xlsx: atenciones realizadas por persona y mes,
//     con Calama y Copiapó bajo la meta (para mostrar alertas de desviación).
//
// Uso:  npm run demo
// ------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { calcularTodo } = require('../src/servicios/planificacion');

const CARPETA = path.join(__dirname, '..', 'excel');
const SALIDA = path.join(CARPETA, 'demo');
if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

// Fecha -> número de serie de Excel
const serie = (a, m, d) => Date.UTC(a, m - 1, d) / 86400000 + 25569;
const AGOSTO = serie(2026, 8, 1);
const JULIO = serie(2026, 7, 1);

// ================= 1) BUK de agosto =================
const libro = XLSX.readFile(path.join(CARPETA, 'Nac - Base contratos x mes.xlsx'));
const hoja = libro.Sheets[libro.SheetNames[0]];
const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true });
const encabezado = filas[1].slice(0, 19); // fila 2 (sin la columna vacía del final)
const col = (nombre) => encabezado.indexOf(nombre);
const C = {
  it: col('IT'), inst: col('Instituto'), pid: col('PersonaId'), periodo: col('Periodo'),
  contrato: col('Tipo de Contrato'), ingreso: col('Fecha Ingreso Compañía'), termino: col('Fecha Término'),
  hs: col('Horas Semanales'), cargo: col('Cargo'), tipo: col('Tipo_Trabajador'), esp: col('Cod_Esp'),
};

const datos = filas.slice(2).filter((f) => f.some((v) => v !== '' && v !== null)).map((f) => f.slice(0, 19));
const julio = datos.filter((f) => Math.round(f[C.periodo]) === Math.round(JULIO));
const agosto = julio.map((f) => {
  const g = [...f];
  g[C.periodo] = AGOSTO;
  return g;
});
const buscar = (pid) => agosto.find((f) => f[C.pid] === pid);

// Cambios
buscar(71580)[C.hs] = 33;                                  // jornada 42 -> 33
buscar(71279)[C.cargo] = 'JEFE KINESIOLOGIA';               // cargo
buscar(72414)[C.termino] = serie(2026, 9, 30);              // vigencia
const sinBaja = agosto.filter((f) => f[C.pid] !== 71960);  // baja

const base = buscar(71580);
const alta = [...base];
alta[C.pid] = 150001; alta[C.contrato] = 'Plazo fijo'; alta[C.ingreso] = AGOSTO; alta[C.hs] = 42;
alta[C.termino] = serie(2027, 1, 31);
const reemplazo = [...buscar(71279)];
reemplazo[C.pid] = 150002; reemplazo[C.cargo] = 'TERAPEUTA OCUPACIONAL'; reemplazo[C.esp] = 'TO';
reemplazo[C.tipo] = 'Reemplazo'; reemplazo[C.contrato] = 'Plazo fijo'; reemplazo[C.hs] = 40;
reemplazo[C.ingreso] = AGOSTO; reemplazo[C.termino] = serie(2026, 11, 30);

// Errores para que el bot (y el backend) los detecten
const duplicada = [...buscar(71580)];
const horasMalas = [...buscar(71697)]; horasMalas[C.hs] = 60;
const fechaMala = [...buscar(71404)]; fechaMala[C.periodo] = '31-02-2026';
const codigoMalo = [...base]; codigoMalo[C.pid] = 150099; codigoMalo[C.esp] = 'XX'; codigoMalo[C.cargo] = 'CARGO INEXISTENTE';
const sinHorasMalas = sinBaja.filter((f) => f[C.pid] !== 71697 && f[C.pid] !== 71404);
// (71697 y 71404 quedan con su fila de agosto mala; sus meses anteriores siguen bien)

const filasAgosto = [...sinHorasMalas, alta, reemplazo, duplicada, horasMalas, fechaMala, codigoMalo];
const vacia = new Array(19).fill('');
const salidaBuk = [
  new Array(19).fill(''),     // fila 1 vacía (igual que el original)
  encabezado,                 // fila 2: encabezados
  ...datos,                   // ene-jul tal cual
  vacia,                      // fila vacía
  encabezado,                 // encabezado repetido
  ...filasAgosto,
];
const hojaBuk = XLSX.utils.aoa_to_sheet(salidaBuk);
// Formato de fecha para las columnas de fechas
const columnasFecha = [col('Fecha de Nacimiento'), C.periodo, C.ingreso, C.termino];
Object.keys(hojaBuk).forEach((ref) => {
  if (ref.startsWith('!')) return;
  const { c } = XLSX.utils.decode_cell(ref);
  if (columnasFecha.includes(c) && typeof hojaBuk[ref].v === 'number') hojaBuk[ref].z = 'dd-mm-yyyy';
});
const libroBuk = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libroBuk, hojaBuk, 'Dotacion_2026');
const archivoBuk = path.join(SALIDA, 'BUK_Agosto_2026_demo.xlsx');
XLSX.writeFile(libroBuk, archivoBuk);
console.log(`Creado ${archivoBuk} (${salidaBuk.length - 2} filas)`);

// ================= 2) SIC enero-julio =================
// Realizado = planificado x un factor (algunos institutos bajo la meta)
let semilla = 7;
const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
const factorIT = { 22: 0.78, 31: 0.83, 131: 0.97, 81: 1.01 }; // Calama y Copiapó bajos
const sic = [['PersonaId', 'IT', 'Periodo', 'Cod_Esp', 'Atenciones Directas', 'Atenciones Indirectas']];
calcularTodo().forEach((r) => {
  if (!r.totales) return;
  for (let m = 1; m <= 7; m++) {
    const x = r.meses[m - 1];
    if (x.planTotal === 0) continue;
    const f = (factorIT[r.it] || 0.95) * (0.9 + azar() * 0.2);
    sic.push([r.personaId, r.it, serie(2026, m, 1), r.codEsp, Math.round(x.planDir * f), Math.round(x.planInd * f)]);
  }
});
const hojaSic = XLSX.utils.aoa_to_sheet(sic);
Object.keys(hojaSic).forEach((ref) => {
  if (!ref.startsWith('!') && XLSX.utils.decode_cell(ref).c === 2 && typeof hojaSic[ref].v === 'number') hojaSic[ref].z = 'dd-mm-yyyy';
});
const libroSic = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libroSic, hojaSic, 'SIC_Atenciones');
const archivoSic = path.join(SALIDA, 'SIC_Ene_Jul_2026_demo.xlsx');
XLSX.writeFile(libroSic, archivoSic);
console.log(`Creado ${archivoSic} (${sic.length - 1} filas)`);
