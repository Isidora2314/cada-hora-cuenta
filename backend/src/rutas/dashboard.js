// ------------------------------------------------------------
// Dashboard: totales listos para mostrar (filtrados por rol)
//   GET /api/dashboard?it=&codEsp=&cargo=&mes=
//   GET /api/institutos
// ------------------------------------------------------------
const express = require('express');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles, filtrarPorAlcance } = require('../middleware/auth');
const { ROLES } = require('../permisos');
const { calcularTodo, agregarRealizado } = require('../servicios/planificacion');

const router = express.Router();

router.get('/institutos', autenticar, (req, res) => {
  // Solo institutos que tienen profesionales planificados
  const conDatos = new Set(repo.leer('planificacion_base').map((f) => f.it));
  res.json(repo.leer('institutos').filter((i) => conDatos.has(i.it)));
});

router.get('/dashboard', autenticar, permitirRoles(ROLES.PLANIFICADOR, ROLES.DMN, ROLES.JEFATURA), (req, res) => {
  const { it, codEsp, cargo } = req.query;
  const mes = req.query.mes ? Number(req.query.mes) : null; // null = todo el año

  let filas = filtrarPorAlcance(req.usuario, repo.leer('planificacion_base'));
  if (it) filas = filas.filter((f) => f.it === Number(it));
  if (codEsp) filas = filas.filter((f) => f.codEsp === codEsp);
  if (cargo) filas = filas.filter((f) => f.cargo === cargo);

  const resultados = calcularTodo({ filas }).filter((r) => r.totales);
  const mesesSic = agregarRealizado(resultados); // meses con datos de SIC
  const generales = repo.leer('parametros_generales');
  const umbral = (generales.find((g) => g.clave === 'umbralAlertaDesviacion') || { valor: 0.1 }).valor;
  const institutos = repo.leer('institutos');
  const nombreIT = (n) => (institutos.find((i) => i.it === n) || {}).nombre || `IT ${n}`;

  // Suma de un conjunto de meses de una fila
  const mesesUsados = mes ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const sumaFila = (r) => {
    const s = { planDir: 0, planInd: 0, planTotal: 0, metaDir: 0, metaTotal: 0, horasDirectas: 0, horasContratadas: 0 };
    s.realizado = 0;
    s.metaConSic = 0; // meta de los meses que ya tienen datos de SIC
    mesesUsados.forEach((m) => {
      const x = r.meses[m - 1];
      ['planDir', 'planInd', 'planTotal', 'metaDir', 'metaTotal', 'horasDirectas', 'horasContratadas'].forEach((k) => { s[k] += x[k]; });
      if (x.realizado !== null) { s.realizado += x.realizado; s.metaConSic += x.metaTotal; }
    });
    // Horas semanales: las del mes elegido o, para el año, las de diciembre (o el último mes con horas)
    const conHoras = r.meses.filter((x) => x.horasSemanales > 0);
    s.horasSemanales = mes ? r.meses[mes - 1].horasSemanales : (conHoras.length ? conHoras[conHoras.length - 1].horasSemanales : 0);
    return s;
  };

  const vacio = () => ({ filas: 0, profesionales: new Set(), horasSemanales: 0, planDir: 0, planInd: 0, planTotal: 0, metaDir: 0, metaTotal: 0, horasDirectas: 0, horasContratadas: 0, realizado: 0, metaConSic: 0 });
  const acumular = (acc, r, s) => {
    acc.filas += 1;
    acc.profesionales.add(r.personaId);
    Object.keys(s).forEach((k) => { acc[k] += s[k]; });
  };
  const cerrar = (acc) => {
    const { profesionales, ...resto } = acc;
    return {
      ...resto,
      profesionales: profesionales.size,
      horasDirectas: Math.round(resto.horasDirectas),
      horasContratadas: Math.round(resto.horasContratadas),
      foja: resto.horasContratadas ? Math.round(10000 * resto.horasDirectas / resto.horasContratadas) / 10000 : null,
      // Cumplimiento = realizado (SIC) / meta de los mismos meses
      cumplimiento: resto.metaConSic ? Math.round(10000 * resto.realizado / resto.metaConSic) / 10000 : null,
      alertaDesviacion: resto.metaConSic ? resto.realizado / resto.metaConSic < 1 - umbral : false,
    };
  };

  const total = vacio();
  const porIT = {};
  const porEsp = {};
  const alertas = { licenciaExtensa: 0, conAlertas: 0 };
  resultados.forEach((r) => {
    const s = sumaFila(r);
    acumular(total, r, s);
    if (!porIT[r.it]) porIT[r.it] = vacio();
    acumular(porIT[r.it], r, s);
    if (!porEsp[r.codEsp]) porEsp[r.codEsp] = vacio();
    acumular(porEsp[r.codEsp], r, s);
    if (r.alertas.length) alertas.conAlertas += 1;
    if (r.alertas.includes('Licencia extensa')) alertas.licenciaExtensa += 1;
  });

  // Serie mensual (siempre los 12 meses, para ver la forma del año)
  const porMes = [];
  for (let m = 1; m <= 12; m++) {
    const x = { mes: m, planDir: 0, planInd: 0, metaTotal: 0, realizado: mesesSic.includes(m) ? 0 : null };
    resultados.forEach((r) => {
      x.planDir += r.meses[m - 1].planDir;
      x.planInd += r.meses[m - 1].planInd;
      x.metaTotal += r.meses[m - 1].metaTotal;
      if (x.realizado !== null) x.realizado += r.meses[m - 1].realizado || 0;
    });
    porMes.push(x);
  }

  const meta = repo.leer('parametros_generales').find((g) => g.clave === 'porcentajeMetaGestion');

  res.json({
    filtros: { it: it ? Number(it) : null, codEsp: codEsp || null, cargo: cargo || null, mes },
    porcentajeMeta: meta ? meta.valor : 0.9,
    mesesSic,
    umbralDesviacion: umbral,
    kpis: cerrar(total),
    alertas,
    porMes,
    porInstituto: Object.keys(porIT).map((k) => ({ it: Number(k), nombre: nombreIT(Number(k)), ...cerrar(porIT[k]) }))
      .sort((a, b) => b.metaTotal - a.metaTotal),
    porEspecialidad: Object.keys(porEsp).map((k) => ({ codEsp: k, ...cerrar(porEsp[k]) }))
      .sort((a, b) => b.metaTotal - a.metaTotal),
    especialidades: [...new Set(filas.map((f) => f.codEsp))].sort(),
  });
});

module.exports = router;
