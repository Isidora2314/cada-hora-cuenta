// ------------------------------------------------------------
// Planificación calculada (filtrada por rol en el backend)
//   GET  /api/planificacion?it=&codEsp=&cargo=&detalle=1
//   GET  /api/planificacion/persona/:personaId     -> mes a mes
//   POST /api/simulaciones                          -> (ver más abajo)
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles, filtrarPorAlcance } = require('../middleware/auth');
const { ROLES } = require('../permisos');
const { calcularTodo, cargarParametros, agregarRealizado } = require('../servicios/planificacion');
const { aplicarCambio } = require('../servicios/parametros');

const router = express.Router();
// (autenticar va en cada ruta porque este router se monta en /api)

const LECTORES = [ROLES.PLANIFICADOR, ROLES.DMN, ROLES.JEFATURA, ROLES.PROFESIONAL];

// Lista de filas calculadas. Sin "detalle=1" no se envían los 12 meses (respuesta liviana).
router.get('/planificacion', autenticar, permitirRoles(...LECTORES), (req, res) => {
  let filas = repo.leer('planificacion_base');
  const { it, codEsp, cargo, detalle } = req.query;
  if (it) filas = filas.filter((f) => f.it === Number(it));
  if (codEsp) filas = filas.filter((f) => f.codEsp === codEsp);
  if (cargo) filas = filas.filter((f) => f.cargo === cargo);
  filas = filtrarPorAlcance(req.usuario, filas);

  const resultados = calcularTodo({ filas });
  const mesesSic = agregarRealizado(resultados);
  // Cumplimiento según SIC (realizado / meta de los meses con datos)
  resultados.forEach((r) => {
    if (!r.totales || !mesesSic.length) return;
    const conDatos = r.meses.filter((x) => x.realizado !== null);
    const meta = conDatos.reduce((a, x) => a + x.metaTotal, 0);
    const hecho = conDatos.reduce((a, x) => a + x.realizado, 0);
    r.totales.realizado = hecho;
    r.totales.cumplimiento = meta ? Math.round(10000 * hecho / meta) / 10000 : null;
  });
  res.json(detalle ? resultados : resultados.map(({ meses, ...resto }) => resto));
});

router.get('/planificacion/persona/:personaId', autenticar, permitirRoles(...LECTORES), (req, res) => {
  const personaId = Number(req.params.personaId);
  const filas = filtrarPorAlcance(req.usuario, repo.leer('planificacion_base'))
    .filter((f) => f.personaId === personaId);
  if (filas.length === 0) return res.status(404).json({ error: 'Profesional no encontrado' });
  const resultados = calcularTodo({ filas });
  agregarRealizado(resultados);
  res.json(resultados);
});

// ------------------------------------------------------------
// Simulación: calcula el impacto de un cambio de parámetro SIN guardarlo.
//   POST /api/simulaciones
//   body: { tabla, clave, valores }   (mismo formato que PUT /api/parametros)
// Devuelve totales nacionales y por instituto, antes y después.
// ------------------------------------------------------------
router.post('/simulaciones', autenticar, permitirRoles(ROLES.PLANIFICADOR, ROLES.DMN), (req, res) => {
  const { tabla, clave, valores } = req.body || {};
  try {
    const nombresParametro = {
      distribucion: 'distribucion', factor_grupal: 'factorGrupal', calendario: 'calendario',
    };
    const cambios = {};
    if (tabla === 'parametros_generales') {
      cambios.generales = { [clave]: valores.valor };
    } else if (nombresParametro[tabla]) {
      cambios[nombresParametro[tabla]] = aplicarCambio(repo.leer(tabla), tabla, clave, valores).copia;
    } else {
      return res.status(400).json({ error: `No se puede simular la tabla "${tabla}"` });
    }

    const antes = resumir(calcularTodo());
    const despues = resumir(calcularTodo({ parametros: cargarParametros(cambios) }));
    const porInstituto = Object.keys(antes.porIT).map((it) => ({
      it: Number(it),
      metaAntes: antes.porIT[it].metaTotal,
      metaDespues: despues.porIT[it].metaTotal,
      diferencia: despues.porIT[it].metaTotal - antes.porIT[it].metaTotal,
    })).filter((x) => x.diferencia !== 0);

    res.json({
      nacional: {
        antes: antes.nacional,
        despues: despues.nacional,
        diferenciaMeta: despues.nacional.metaTotal - antes.nacional.metaTotal,
      },
      institutosAfectados: porInstituto,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Suma totales nacionales y por instituto
function resumir(resultados) {
  const vacio = () => ({ planTotal: 0, metaTotal: 0, metaDir: 0, horasDirectas: 0, horasContratadas: 0 });
  const nacional = vacio();
  const porIT = {};
  resultados.forEach((r) => {
    if (!r.totales) return;
    if (!porIT[r.it]) porIT[r.it] = vacio();
    [nacional, porIT[r.it]].forEach((acc) => {
      acc.planTotal += r.totales.planTotal;
      acc.metaTotal += r.totales.metaTotal;
      acc.metaDir += r.totales.metaDir;
      acc.horasDirectas += r.totales.horasDirectas;
      acc.horasContratadas += r.totales.horasContratadas;
    });
  });
  nacional.foja = nacional.horasContratadas ? Math.round(10000 * nacional.horasDirectas / nacional.horasContratadas) / 10000 : null;
  return { nacional, porIT };
}

module.exports = router;
