// ------------------------------------------------------------
// Profesionales (lectura). El filtro por rol se hace AQUÍ, en el backend:
//   - PLANIFICADOR y DMN ven todo el país
//   - JEFATURA solo su instituto
//   - PROFESIONAL solo a sí mismo
//
//   GET /api/profesionales?it=&codEsp=&cargo=
//   GET /api/profesionales/:personaId   -> sus contratos mes a mes
//
// (La planificación calculada se agrega en la etapa 3)
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles, filtrarPorAlcance } = require('../middleware/auth');
const { ROLES } = require('../permisos');

const router = express.Router();
router.use(autenticar, permitirRoles(ROLES.PLANIFICADOR, ROLES.DMN, ROLES.JEFATURA, ROLES.PROFESIONAL));

// Mínimo de datos: solo los campos que la vista necesita
function resumen(r) {
  return {
    personaId: r.personaId,
    it: r.it,
    instituto: r.instituto,
    subArea: r.subArea,
    codEsp: r.codEsp,
    cargo: r.cargo,
    tipoContrato: r.tipoContrato,
    tipoTrabajador: r.tipoTrabajador,
    horasSemanales: r.horasSemanales,
    periodo: r.periodo,
  };
}

router.get('/', (req, res) => {
  const dotacion = filtrarPorAlcance(req.usuario, repo.leer('dotacion'));

  // Nos quedamos con el último mes de cada persona en cada instituto
  const ultimos = {};
  dotacion.forEach((r) => {
    const clave = `${r.personaId}-${r.it}`;
    if (!ultimos[clave] || r.periodo > ultimos[clave].periodo) ultimos[clave] = r;
  });
  let lista = Object.values(ultimos).map(resumen);

  // Filtros opcionales
  const { it, codEsp, cargo } = req.query;
  if (it) lista = lista.filter((p) => p.it === Number(it));
  if (codEsp) lista = lista.filter((p) => p.codEsp === codEsp);
  if (cargo) lista = lista.filter((p) => p.cargo === cargo);

  lista.sort((a, b) => a.it - b.it || a.personaId - b.personaId);
  res.json(lista);
});

router.get('/:personaId', (req, res) => {
  const personaId = Number(req.params.personaId);
  const registros = filtrarPorAlcance(req.usuario, repo.leer('dotacion'))
    .filter((r) => r.personaId === personaId);

  // Si no está en su alcance, para el usuario "no existe"
  if (registros.length === 0) {
    return res.status(404).json({ error: 'Profesional no encontrado' });
  }
  registros.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.it - b.it);
  res.json({ personaId, meses: registros.map(resumen) });
});

module.exports = router;
