// ------------------------------------------------------------
// Cambios detectados por el bot (revisión humana)
//   GET  /api/cambios?estado=PENDIENTE      -> lista con impacto en la meta
//   POST /api/cambios/:id/aplicar           -> aplica desde su mes de vigencia (PLANIFICADOR)
//   POST /api/cambios/:id/descartar         -> lo descarta con justificación (PLANIFICADOR)
//   POST /api/cambios/aplicar-todos         -> aplica todos los pendientes (PLANIFICADOR)
//   GET  /api/cargas                        -> historial de cargas y errores
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../permisos');
const { aplicarCambio } = require('../servicios/ingesta');
const { calcularTodo, ausenciasEstandar } = require('../servicios/planificacion');
const auditoria = require('../servicios/auditoria');

const router = express.Router();
const LECTORES = [ROLES.PLANIFICADOR, ROLES.DMN, ROLES.ADMIN];

// Meta anual de una persona en un instituto, con la dotación y planificación dadas
function metaDe(personaId, it, dotacion, planificacion) {
  const filas = planificacion.filter((f) => f.personaId === personaId && f.it === it);
  if (!filas.length) return { metaTotal: 0, planTotal: 0 };
  return calcularTodo({ filas, dotacion }).reduce((acc, r) => ({
    metaTotal: acc.metaTotal + (r.totales ? r.totales.metaTotal : 0),
    planTotal: acc.planTotal + (r.totales ? r.totales.planTotal : 0),
  }), { metaTotal: 0, planTotal: 0 });
}

function contexto() {
  const planificacion = repo.leer('planificacion_base');
  return {
    dotacion: repo.leer('dotacion'),
    planificacion,
    ausenciasEstandar: ausenciasEstandar(planificacion),
    institutos: repo.leer('institutos'),
  };
}

router.get('/cambios', autenticar, permitirRoles(...LECTORES), (req, res) => {
  const estado = req.query.estado || 'PENDIENTE';
  const ctx = contexto();
  const nombreIT = (it) => (ctx.institutos.find((i) => i.it === it) || {}).nombre || `IT ${it}`;
  const lista = repo.leer('cambios')
    .filter((c) => estado === 'TODOS' || c.estado === estado)
    .map(({ registros, ...c }) => {
      let impacto = null;
      if (c.estado === 'PENDIENTE') {
        // ¿Cuánto cambia la meta de esta persona si se aplica?
        const antes = metaDe(c.personaId, c.it, ctx.dotacion, ctx.planificacion);
        const sim = aplicarCambio(c, { ...ctx, reporte: registros });
        const despues = metaDe(c.personaId, c.it, sim.dotacion, sim.planificacion);
        impacto = { metaAntes: antes.metaTotal, metaDespues: despues.metaTotal, diferencia: despues.metaTotal - antes.metaTotal };
      }
      return { ...c, nombreInstituto: nombreIT(c.it), impacto };
    })
    .sort((a, b) => b.id - a.id);
  res.json(lista);
});

// Aplica un cambio y guarda dotación + planificación
function aplicar(cambio, usuario, justificacion) {
  const ctx = contexto();
  const antes = metaDe(cambio.personaId, cambio.it, ctx.dotacion, ctx.planificacion);
  const r = aplicarCambio(cambio, { ...ctx, reporte: cambio.registros || [] });
  repo.guardar('dotacion', r.dotacion);
  repo.guardar('planificacion_base', r.planificacion);
  const despues = metaDe(cambio.personaId, cambio.it, r.dotacion, r.planificacion);

  cambio.estado = 'APLICADO';
  cambio.aplicadoEl = new Date().toISOString();
  cambio.aplicadoPor = usuario.email;
  cambio.impactoAplicado = { metaAntes: antes.metaTotal, metaDespues: despues.metaTotal, diferencia: despues.metaTotal - antes.metaTotal };

  auditoria.registrar({
    usuario, accion: 'APLICAR_CAMBIO', entidad: `cambio:${cambio.tipo}`, idEntidad: cambio.id,
    valorAnterior: cambio.antes, valorNuevo: { ...cambio.despues, vigencia: cambio.vigencia, personaId: cambio.personaId, it: cambio.it },
    justificacion: justificacion || `Cambio detectado en BUK (carga ${cambio.cargaId})`,
  });
  return cambio.impactoAplicado;
}

router.post('/cambios/aplicar-todos', autenticar, permitirRoles(ROLES.PLANIFICADOR), (req, res) => {
  const cambios = repo.leer('cambios');
  // Se aplican en orden de vigencia para que los meses queden bien
  const pendientes = cambios.filter((c) => c.estado === 'PENDIENTE').sort((a, b) => a.vigencia.localeCompare(b.vigencia) || a.id - b.id);
  let diferencia = 0;
  pendientes.forEach((c) => {
    try {
      diferencia += aplicar(c, req.usuario, req.body && req.body.justificacion).diferencia;
    } catch (e) {
      c.estado = 'ERROR'; c.error = e.message;
    }
  });
  repo.guardar('cambios', cambios);
  res.json({ aplicados: pendientes.filter((c) => c.estado === 'APLICADO').length, diferenciaMeta: diferencia });
});

router.post('/cambios/:id/aplicar', autenticar, permitirRoles(ROLES.PLANIFICADOR), (req, res) => {
  const cambios = repo.leer('cambios');
  const cambio = cambios.find((c) => c.id === Number(req.params.id));
  if (!cambio) return res.status(404).json({ error: 'Cambio no encontrado' });
  if (cambio.estado !== 'PENDIENTE') return res.status(409).json({ error: `Este cambio ya está ${cambio.estado.toLowerCase()}` });
  try {
    const impacto = aplicar(cambio, req.usuario, req.body && req.body.justificacion);
    repo.guardar('cambios', cambios);
    res.json({ mensaje: 'Cambio aplicado', impacto });
  } catch (e) {
    res.status(500).json({ error: `No se pudo aplicar: ${e.message}` });
  }
});

router.post('/cambios/:id/descartar', autenticar, permitirRoles(ROLES.PLANIFICADOR), (req, res) => {
  const justificacion = req.body && req.body.justificacion;
  if (!justificacion) return res.status(400).json({ error: 'Indica por qué se descarta el cambio' });
  const cambios = repo.leer('cambios');
  const cambio = cambios.find((c) => c.id === Number(req.params.id));
  if (!cambio) return res.status(404).json({ error: 'Cambio no encontrado' });
  if (cambio.estado !== 'PENDIENTE') return res.status(409).json({ error: `Este cambio ya está ${cambio.estado.toLowerCase()}` });
  cambio.estado = 'DESCARTADO';
  cambio.descartadoPor = req.usuario.email;
  repo.guardar('cambios', cambios);
  auditoria.registrar({ usuario: req.usuario, accion: 'DESCARTAR_CAMBIO', entidad: `cambio:${cambio.tipo}`, idEntidad: cambio.id, valorAnterior: cambio.despues, justificacion });
  res.json({ mensaje: 'Cambio descartado' });
});

router.get('/cargas', autenticar, permitirRoles(...LECTORES), (req, res) => {
  const cargas = [...repo.leer('cargas')].reverse();
  const errores = repo.leer('errores_carga');
  res.json({
    cargas: cargas.map((c) => ({ ...c, listaErrores: errores.filter((e) => e.cargaId === c.id).slice(0, 200) })),
    cambiosPendientes: repo.leer('cambios').filter((c) => c.estado === 'PENDIENTE').length,
  });
});

module.exports = router;
