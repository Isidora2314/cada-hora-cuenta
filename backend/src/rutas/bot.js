// ------------------------------------------------------------
// Rutas que usa Blue Prism (protegidas con API key, header x-api-key)
//   POST /api/bot/buk      -> reporte de dotación (BUK)
//   POST /api/bot/sic      -> atenciones realizadas (SIC)
//   POST /api/bot/errores  -> errores que el bot encontró al leer el Excel
//   GET  /api/bot/estado   -> última carga y resumen
//   GET  /api/bot/ping     -> prueba de conexión
// El formato exacto está en docs/contrato-bot.md
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { validarApiKeyBot } = require('../middleware/botApiKey');
const { validarBuk, detectarCambios, normalizarSic, detectarOrdenFechas } = require('../servicios/ingesta');
const auditoria = require('../servicios/auditoria');

const router = express.Router();
router.use(validarApiKeyBot);

// El bot puede enviar { registros: [...] } o directamente la lista
const leerRegistros = (body) => (Array.isArray(body) ? body : (body && (body.registros || body.filas || body.datos)) || []);

// Registra una carga en el historial
function nuevaCarga(datos) {
  const cargas = repo.leer('cargas');
  const carga = { id: cargas.length + 1, fechaHora: new Date().toISOString(), ...datos };
  cargas.push(carga);
  repo.guardar('cargas', cargas);
  return carga;
}

function guardarErrores(cargaId, origen, errores) {
  if (!errores.length) return;
  const todos = repo.leer('errores_carga');
  errores.forEach((e) => todos.push({ cargaId, origen, ...e }));
  repo.guardar('errores_carga', todos);
}

router.get('/ping', (req, res) => res.json({ mensaje: 'Conexión con Blue Prism OK' }));

// ---------------- BUK ----------------
router.post('/buk', (req, res) => {
  const registros = leerRegistros(req.body);
  if (!registros.length) return res.status(400).json({ error: 'El reporte viene vacío: envía { "registros": [ ... ] }' });

  const archivo = (req.body && req.body.archivo) || 'reporte BUK';
  const { validos, errores, resumen } = validarBuk(registros, {
    distribucion: repo.leer('distribucion'),
    homologacion: repo.leer('homologacion'),
  });

  const id = repo.leer('cargas').length + 1;
  const dotacion = repo.leer('dotacion');
  const conError = new Set(errores.map((e) => e.personaId).filter(Boolean));
  const { cambios, sinCambios } = detectarCambios(dotacion, validos, id, conError);

  // 1) Lo que NO cambia (solo agrega meses nuevos iguales) se actualiza solo
  const llavesSinCambio = new Set(sinCambios);
  const nuevosSinCambio = validos.filter((r) => llavesSinCambio.has(`${r.personaId}|${r.it}`));
  const reemplazar = new Set(nuevosSinCambio.map((r) => `${r.personaId}|${r.it}|${r.periodo}`));
  const dotacionNueva = [
    ...dotacion.filter((r) => !reemplazar.has(`${r.personaId}|${r.it}|${r.periodo}`)),
    ...nuevosSinCambio,
  ];
  repo.guardar('dotacion', dotacionNueva);

  // 2) Lo que cambia queda PENDIENTE de revisión por Planificación
  const pendientes = repo.leer('cambios');
  // Si ya había un cambio pendiente igual para la misma persona, el nuevo lo reemplaza
  cambios.forEach((c) => {
    pendientes
      .filter((p) => p.estado === 'PENDIENTE' && p.personaId === c.personaId && p.it === c.it && p.tipo === c.tipo)
      .forEach((p) => { p.estado = 'REEMPLAZADO'; });
  });
  let siguiente = Math.max(0, ...pendientes.map((c) => c.id)) + 1;
  cambios.forEach((c) => {
    pendientes.push({
      id: siguiente++,
      ...c,
      estado: 'PENDIENTE',
      detectadoEl: new Date().toISOString(),
      // Guarda las filas del reporte de esta persona para poder aplicar el cambio después
      registros: validos.filter((r) => r.personaId === c.personaId && r.it === c.it),
    });
  });
  repo.guardar('cambios', pendientes);

  const porTipo = {};
  cambios.forEach((c) => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; });
  const periodos = [...new Set(validos.map((r) => r.periodo))].sort();

  const carga = nuevaCarga({
    tipo: 'BUK', archivo, resumen: { ...resumen, actualizadosSinRevision: nuevosSinCambio.length },
    periodos: periodos.length ? [periodos[0], periodos[periodos.length - 1]] : [],
    cambiosDetectados: cambios.length, cambiosPorTipo: porTipo, errores: errores.length,
  });
  guardarErrores(carga.id, 'BACKEND', errores);
  auditoria.registrar({
    usuario: req.usuario, accion: 'CARGA_BUK', entidad: 'carga', idEntidad: carga.id,
    valorNuevo: { archivo, ...carga.resumen, cambios: cambios.length, errores: errores.length },
  });

  res.json({
    cargaId: carga.id,
    resumen: carga.resumen,
    cambiosDetectados: cambios.length,
    cambiosPorTipo: porTipo,
    errores: errores.slice(0, 100),
    totalErrores: errores.length,
  });
});

// ---------------- SIC ----------------
router.post('/sic', (req, res) => {
  const registros = leerRegistros(req.body);
  if (!registros.length) return res.status(400).json({ error: 'El reporte viene vacío: envía { "registros": [ ... ] }' });
  const archivo = (req.body && req.body.archivo) || 'reporte SIC';

  detectarOrdenFechas(registros);
  const errores = [];
  const validos = [];
  registros.forEach((original, i) => {
    const r = normalizarSic(original);
    if (!r.personaId && !r.it && !r.periodo) return; // fila vacía
    if (!r.personaId || !r.it) { errores.push({ fila: i + 1, columna: 'PersonaId', tipo: 'DATO_FALTANTE', valor: null, mensaje: 'Falta PersonaId o IT' }); return; }
    if (!r.periodo) { errores.push({ fila: i + 1, columna: 'Periodo', tipo: 'FECHA_INVALIDA', valor: original.Periodo || original.periodo, mensaje: 'El período no es una fecha válida', personaId: r.personaId }); return; }
    if (r.atencionesDirectas < 0 || r.atencionesIndirectas < 0) { errores.push({ fila: i + 1, columna: 'Atenciones', tipo: 'VALOR_INVALIDO', valor: r.atencionesDirectas, mensaje: 'Las atenciones no pueden ser negativas', personaId: r.personaId }); return; }
    validos.push(r);
  });

  // Reemplaza lo realizado de los mismos meses (permite volver a cargar un mes corregido)
  const periodos = new Set(validos.map((r) => r.periodo));
  const realizado = repo.leer('realizado').filter((r) => !periodos.has(r.periodo));
  repo.guardar('realizado', [...realizado, ...validos]);

  const lista = [...periodos].sort();
  const carga = nuevaCarga({
    tipo: 'SIC', archivo,
    resumen: { recibidos: registros.length, cargados: validos.length, conError: errores.length },
    periodos: lista.length ? [lista[0], lista[lista.length - 1]] : [], errores: errores.length,
  });
  guardarErrores(carga.id, 'BACKEND', errores);
  auditoria.registrar({ usuario: req.usuario, accion: 'CARGA_SIC', entidad: 'carga', idEntidad: carga.id, valorNuevo: carga.resumen });

  res.json({ cargaId: carga.id, resumen: carga.resumen, periodos: lista, errores: errores.slice(0, 100), totalErrores: errores.length });
});

// ---------------- Errores informados por el bot ----------------
router.post('/errores', (req, res) => {
  const errores = (req.body && req.body.errores) || [];
  const archivo = (req.body && req.body.archivo) || 'reporte';
  const carga = nuevaCarga({ tipo: 'VALIDACION_BOT', archivo, resumen: { errores: errores.length }, errores: errores.length });
  guardarErrores(carga.id, 'BLUE_PRISM', errores.map((e) => ({
    fila: e.fila ?? null, columna: e.columna ?? null, tipo: e.tipo || 'ERROR', valor: e.valor ?? null, mensaje: e.mensaje || '',
  })));
  res.json({ cargaId: carga.id, recibidos: errores.length });
});

// ---------------- Estado ----------------
router.get('/estado', (req, res) => {
  const cargas = repo.leer('cargas');
  const ultima = (tipo) => [...cargas].reverse().find((c) => c.tipo === tipo) || null;
  res.json({
    ultimaBuk: ultima('BUK'),
    ultimaSic: ultima('SIC'),
    cambiosPendientes: repo.leer('cambios').filter((c) => c.estado === 'PENDIENTE').length,
    totalCargas: cargas.length,
  });
});

module.exports = router;
