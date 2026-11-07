// ------------------------------------------------------------
// Panorama nacional: Meta de Gestión, % FOJA, el año mes a mes,
// meta por instituto y la tabla consolidada (como "Planificación Total").
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, n, pct, MESES_LARGO, nombreEsp } from '../api';
import { useSesion } from '../sesion';
import Filtros from '../componentes/Filtros';
import { GraficoAnio, BarrasMeta, Foja } from '../componentes/Graficos';

export default function Dashboard({ itFijo = null, titulo, migas }) {
  const { sesion } = useSesion();
  const navegar = useNavigate();
  const [filtros, setFiltros] = useState({ it: itFijo, codEsp: null, mes: null });
  const [datos, setDatos] = useState(null);
  const [institutos, setInstitutos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => { setFiltros((f) => ({ ...f, it: itFijo })); }, [itFijo]);

  useEffect(() => {
    api('/institutos').then(setInstitutos).catch(() => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) q.set(k, v); });
    setError('');
    api(`/dashboard?${q}`).then(setDatos).catch((e) => setError(e.message));
  }, [filtros]);

  if (error) return <div className="mensaje-error" role="alert">{error}</div>;
  if (!datos) return <p className="cargando">Calculando la planificación…</p>;

  const { kpis, porMes, porInstituto, porEspecialidad, alertas } = datos;
  const periodo = filtros.mes ? `en ${MESES_LARGO[filtros.mes - 1]}` : 'en 2026';
  const variosIT = porInstituto.length > 1;
  const nombreInstituto = institutos.find((i) => i.it === Number(filtros.it))?.nombre;

  const barras = variosIT
    ? porInstituto.map((f) => ({ clave: f.it, nombre: f.nombre, metaTotal: f.metaTotal, planDir: f.planDir, planTotal: f.planTotal, enlace: `/instituto/${f.it}` }))
    : porEspecialidad.map((f) => ({ clave: f.codEsp, nombre: nombreEsp(f.codEsp), metaTotal: f.metaTotal, planDir: f.planDir, planTotal: f.planTotal }));

  return (
    <>
      <header className="encabezado">
        <div>
          {migas}
          <h1>{titulo || (nombreInstituto ? `Instituto ${nombreInstituto}` : 'Panorama nacional')}</h1>
          <p className="bajada">
            {sesion.usuario.rol === 'JEFATURA'
              ? 'Planificación de tu instituto, calculada con la dotación vigente de BUK.'
              : 'Planificación de todos los institutos, calculada con la dotación vigente de BUK.'}
          </p>
        </div>
      </header>

      <Filtros
        valores={filtros}
        cambiar={setFiltros}
        institutos={institutos}
        especialidades={datos.especialidades}
        mostrarInstituto={!itFijo && sesion.usuario.rol !== 'JEFATURA'}
      />

      <section className="portada" aria-labelledby="meta-titulo">
        <div>
          <div className="portada-cifra num" id="meta-titulo">{n(kpis.metaTotal)}</div>
          <p className="portada-frase">atenciones comprometidas como Meta de Gestión {periodo}</p>
          <p className="portada-detalle">
            Es el {pct(datos.porcentajeMeta, 0)} de las {n(kpis.planTotal)} atenciones planificadas para {n(kpis.profesionales)} profesionales
            {variosIT ? ` en ${porInstituto.length} institutos` : ''}.
          </p>
        </div>
        <dl className="indicadores">
          <div className="indicador"><dt>Meta atención directa</dt><dd className="num">{n(kpis.metaDir)}</dd></div>
          <div className="indicador"><dt>% FOJA</dt><dd className="num">{pct(kpis.foja)} <small>horas directas / contratadas</small></dd></div>
          <div className="indicador"><dt>Horas semanales</dt><dd className="num">{n(kpis.horasSemanales)}</dd></div>
          <div className="indicador"><dt>Atenciones directas</dt><dd className="num">{n(kpis.planDir)}</dd></div>
          <div className="indicador"><dt>Atenciones indirectas</dt><dd className="num">{n(kpis.planInd)}</dd></div>
          {datos.mesesSic.length > 0
            ? <div className="indicador"><dt>Cumplimiento SIC ({MESES_LARGO[datos.mesesSic[0] - 1].slice(0, 3)} a {MESES_LARGO[datos.mesesSic[datos.mesesSic.length - 1] - 1].slice(0, 3)})</dt>
                <dd className="num" style={{ color: kpis.alertaDesviacion ? 'var(--rojo-oscuro)' : undefined }}>{pct(kpis.cumplimiento)} <small>realizado / meta</small></dd></div>
            : <div className="indicador"><dt>Con licencia extensa</dt><dd className="num">{n(alertas.licenciaExtensa)}</dd></div>}
        </dl>
      </section>

      <div className="grilla-2">
        <section className="panel" aria-labelledby="t-anio">
          <h2 id="t-anio">El año mes a mes</h2>
          <p style={{ color: 'var(--texto-2)', fontSize: '.9rem', margin: '4px 0 10px' }}>
            Febrero baja por vacaciones. Toca un mes para ver solo ese período.
          </p>
          <GraficoAnio meses={porMes} mesElegido={filtros.mes} alElegir={(m) => setFiltros({ ...filtros, mes: m })} />
        </section>

        <section className="panel" aria-labelledby="t-barras">
          <div className="panel-cabeza">
            <h2 id="t-barras">{variosIT ? 'Meta por instituto' : 'Meta por especialidad'}</h2>
            <div className="leyenda"><span><i className="muestra directa" />Directa</span><span><i className="muestra indirecta" />Indirecta</span></div>
          </div>
          <BarrasMeta filas={barras} />
        </section>
      </div>

      <section className="panel" aria-labelledby="t-tabla">
        <div className="panel-cabeza">
          <h2 id="t-tabla">{variosIT ? 'Planificación por instituto' : 'Planificación por especialidad'}</h2>
          <p>{variosIT ? 'Selecciona un instituto para ver a sus profesionales.' : ''}</p>
        </div>
        <div className="tabla-envoltura">
          <table>
            <caption className="oculto-visual">Resumen {periodo}</caption>
            <thead>
              <tr>
                <th>{variosIT ? 'Instituto' : 'Especialidad'}</th>
                <th className="n">Profesionales</th>
                <th className="n">Horas sem.</th>
                <th className="n">Directas</th>
                <th className="n">Indirectas</th>
                <th className="n">Total planificado</th>
                <th className="n">Meta de Gestión</th>
                <th>% FOJA</th>
                {datos.mesesSic.length > 0 && <th className="n">Cumplimiento SIC</th>}
              </tr>
            </thead>
            <tbody>
              {(variosIT ? porInstituto : porEspecialidad).map((f) => (
                <tr
                  key={f.it || f.codEsp}
                  className={variosIT ? 'clic' : ''}
                  onClick={variosIT ? () => navegar(`/instituto/${f.it}`) : undefined}
                >
                  <td>
                    {variosIT
                      ? <a href={`/instituto/${f.it}`} onClick={(e) => { e.preventDefault(); navegar(`/instituto/${f.it}`); }}>{f.nombre}</a>
                      : nombreEsp(f.codEsp)}
                  </td>
                  <td className="n">{n(f.profesionales)}</td>
                  <td className="n">{n(f.horasSemanales)}</td>
                  <td className="n">{n(f.planDir)}</td>
                  <td className="n">{n(f.planInd)}</td>
                  <td className="n">{n(f.planTotal)}</td>
                  <td className="n"><b>{n(f.metaTotal)}</b></td>
                  <td><Foja valor={f.foja} /></td>
                  {datos.mesesSic.length > 0 && <td className="n"><Cumplimiento f={f} /></td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="n">{n(kpis.profesionales)}</td>
                <td className="n">{n(kpis.horasSemanales)}</td>
                <td className="n">{n(kpis.planDir)}</td>
                <td className="n">{n(kpis.planInd)}</td>
                <td className="n">{n(kpis.planTotal)}</td>
                <td className="n">{n(kpis.metaTotal)}</td>
                <td><Foja valor={kpis.foja} /></td>
                {datos.mesesSic.length > 0 && <td className="n"><Cumplimiento f={kpis} /></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}

// Cumplimiento = realizado según SIC / meta de los mismos meses (con alerta si se aleja mucho)
function Cumplimiento({ f }) {
  if (f.cumplimiento === null || f.cumplimiento === undefined) return '–';
  return f.alertaDesviacion
    ? <span className="chip alerta" title="Bajo la meta más allá del umbral de alerta">{pct(f.cumplimiento)} bajo meta</span>
    : <span className="num">{pct(f.cumplimiento)}</span>;
}
