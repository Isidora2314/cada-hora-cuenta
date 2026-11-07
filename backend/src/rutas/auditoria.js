// ------------------------------------------------------------
// Registro de auditoría (ADMIN y PLANIFICADOR, solo lectura)
//   GET /api/auditoria?accion=&usuario=
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../permisos');

const router = express.Router();

router.get('/', autenticar, permitirRoles(ROLES.ADMIN, ROLES.PLANIFICADOR), (req, res) => {
  let log = [...repo.leer('auditoria')].reverse();
  if (req.query.accion) log = log.filter((x) => x.accion === req.query.accion);
  if (req.query.usuario) log = log.filter((x) => x.usuario === req.query.usuario);
  res.json(log.slice(0, 500));
});

module.exports = router;
