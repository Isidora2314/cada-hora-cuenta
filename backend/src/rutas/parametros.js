// ------------------------------------------------------------
// Parámetros del cálculo
//   GET  /api/parametros                 -> todas las tablas (lectura)
//   PUT  /api/parametros/:tabla/:clave   -> editar una fila (solo PLANIFICADOR)
//        body: { valores: {...}, justificacion: "..." }
//
// Ejemplos:
//   PUT /api/parametros/parametros_generales/porcentajeMetaGestion
//       { "valores": { "valor": 0.85 }, "justificacion": "Acuerdo DMN" }
//   PUT /api/parametros/distribucion/KINESIOLOGO
//       { "valores": { "tramos": { "mayorIgual40": { "dir": 0.6, "ind": 0.15 } } }, "justificacion": "..." }
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../permisos');
const { TABLAS_EDITABLES, aplicarCambio } = require('../servicios/parametros');
const auditoria = require('../servicios/auditoria');

const router = express.Router();
router.use(autenticar);

router.get('/', permitirRoles(ROLES.PLANIFICADOR, ROLES.DMN, ROLES.JEFATURA), (req, res) => {
  const respuesta = {};
  Object.keys(TABLAS_EDITABLES).forEach((t) => { respuesta[t] = repo.leer(t); });
  respuesta.institutos = repo.leer('institutos');
  res.json(respuesta);
});

router.put('/:tabla/:clave', permitirRoles(ROLES.PLANIFICADOR), (req, res) => {
  const { tabla, clave } = req.params;
  const { valores, justificacion } = req.body || {};
  if (!justificacion) return res.status(400).json({ error: 'La justificación es obligatoria' });
  if (!valores) return res.status(400).json({ error: 'Faltan los valores a cambiar' });

  try {
    const { copia, anterior, nueva } = aplicarCambio(repo.leer(tabla), tabla, clave, valores);
    repo.guardar(tabla, copia);
    auditoria.registrar({
      usuario: req.usuario, accion: 'EDITAR', entidad: `parametro:${tabla}`, idEntidad: clave,
      valorAnterior: anterior, valorNuevo: nueva, justificacion,
    });
    res.json(nueva);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
