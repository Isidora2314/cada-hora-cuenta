// ------------------------------------------------------------
// Detalle de un profesional: cómo se reparten sus horas y su
// planificación mes a mes. El rol PROFESIONAL solo llega aquí.
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, n, pct, MESES_LARGO, nombreEsp, cargoBonito } from '../api';
import { useSesion } from '../sesion';
import { GraficoAnio } from '../componentes/Graficos';

const TRAMOS = { mayorIgual40: '40 h o más', entre22y40: 'Entre 22 y 40 h', menor22: 'Menos de 22 h' };

export default function Profesional() {
  const { personaId } = useParams();
  const { sesion } = useSesion();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [institutos, setInstitutos] = useState([]);

  useEffect(() => {
    setFilas(null);
    setError('');
    api(`/planificacion/persona/${personaId}`).then(setFilas).catch((e) => setError(e.message));
    api('/institutos').then(setInstitutos).catch(() => {});
  }, [personaId]);

  if (error) {
    return (
      <div className="panel vacio">
        <h2>No encontramos a este profesional</h2>
        <p>{error}. Puede que no esté dentro de los institutos que puedes ver.</p>
      </div>
    );
  }
  if (!filas) return <p className="cargando">Cargando planificación…</p>;

  const esPropio = sesion.usuario.rol === 'PROFESIONAL';
  const nombreIT = (it) => institutos.find((i) => i.it === it)?.nombre || `IT ${it}`;
  const primera = filas[0];

  // Suma los meses de todas sus filas (multi-instituto o cambios de jornada)
  const meses = Array.from({ length: 12 }, (_, i) => {
    const x = { mes: i + 1, planDir: 0, planInd: 0, metaTotal: 0, realizado: null };
    filas.forEach((f) => {
      x.planDir += f.meses[i].planDir; x.planInd += f.meses[i].planInd; x.metaTotal += f.meses[i].metaTotal;
      if (f.meses[i].realizado !== null && f.meses[i].realizado !== undefined) x.realizado = (x.realizado || 0) + f.meses[i].realizado;
    });
    return x;
  });
  const total = (campo) => filas.reduce((s, f) => s + (f.totales ? f.totales[campo] : 0), 0);
  const horasDir = total('horasDirectas');
  const horasCon = total('horasContratadas');

  return (
    <>
      <header className="encabezado">
        <div>
          {!esPropio && (
            <nav className="migas" aria-label="Ruta">
              {sesion.usuario.rol !== 'JEFATURA' && <><Link to="/dashboard">Panorama nacional</Link> / </>}
              <Link to={`/instituto/${primera.it}`}>Instituto {nombreIT(primera.it)}</Link> / Profesional {personaId}
            </nav>
          )}
          <h1>{esPropio ? 'Mi planificación 2026' : `Profesional ${personaId}`}</h1>
          <p className="bajada">
            {cargoBonito(primera.cargo)} en {nombreEsp(primera.codEsp)}
            {filas.length > 1 ? `, con ${filas.length} períodos o institutos.` : '.'}
            {' '}Las horas vienen de BUK y se actualizan cuando llega un reporte nuevo.
          </p>
        </div>
      </header>

      <dl className="ficha">
        <div><dt>Meta de Gestión anual</dt><dd className="num">{n(total('metaTotal'))}<small>atenciones comprometidas</small></dd></div>
        <div><dt>Atenciones planificadas</dt><dd className="num">{n(total('planTotal'))}<small>{n(total('planDir'))} directas y {n(total('planInd'))} indirectas</small></dd></div>
        <div><dt>% FOJA</dt><dd className="num">{pct(horasCon ? horasDir / horasCon : null)}<small>horas directas / contratadas</small></dd></div>
        <div><dt>Horas semanales</dt><dd className="num">{primera.detalle?.promedioPonderado ?? '–'}<small>promedio ponderado del período</small></dd></div>
      </dl>

      <div className="grilla-2">
        <section className="panel" aria-labelledby="t-anio">
          <h2 id="t-anio" style={{ marginBottom: 10 }}>Atenciones planificadas por mes</h2>
          <GraficoAnio meses={meses} />
        </section>

        <div className="pila">
          {filas.map((f) => <Reparto key={f.filaId} fila={f} varias={filas.length > 1} nombre={nombreIT(f.it)} />)}
        </div>
      </div>

      <section className="panel" aria-labelledby="t-mes">
        <h2 id="t-mes" style={{ marginBottom: 10 }}>Detalle mes a mes</h2>
        {filas.map((f) => (
          <div className="tabla-envoltura" key={f.filaId} style={{ marginBottom: 16 }}>
            <table>
              <caption>
                Instituto {nombreIT(f.it)}, {f.desde === 1 && f.hasta === 12 ? 'todo el año' : `${MESES_LARGO[f.desde - 1]} a ${MESES_LARGO[f.hasta - 1]}`}
              </caption>
              <thead>
                <tr>
                  <th>Mes</th><th className="n">Horas sem.</th><th className="n">Semanas hábiles</th>
                  <th className="n">Directas / sem.</th><th className="n">Indirectas / sem.</th>
                  <th className="n">Directas mes</th><th className="n">Total mes</th><th className="n">Meta mes</th><th className="n">Realizado SIC</th><th className="n">% FOJA</th>
                </tr>
              </thead>
              <tbody>
                {f.meses.filter((m) => m.mes >= f.desde && m.mes <= f.hasta).map((m) => (
                  <tr key={m.mes} style={m.horasSemanales === 0 ? { color: 'var(--texto-3)' } : undefined}>
                    <td>{MESES_LARGO[m.mes - 1]}</td>
                    <td className="n">{m.horasSemanales || '–'}</td>
                    <td className="n">{m.semanasHabiles.toLocaleString('es-CL')}</td>
                    <td className="n">{m.ateDirSemana.toLocaleString('es-CL')}</td>
                    <td className="n">{m.ateIndSemana}</td>
                    <td className="n">{n(m.planDir)}</td>
                    <td className="n">{n(m.planTotal)}</td>
                    <td className="n"><b>{n(m.metaTotal)}</b></td>
                    <td className="n">{m.realizado === null || m.realizado === undefined ? '–' : n(m.realizado)}</td>
                    <td className="n">{m.foja === null ? '–' : pct(m.foja)}</td>
                  </tr>
                ))}
              </tbody>
              {f.totales && (
                <tfoot>
                  <tr>
                    <td>Total</td><td /><td /><td /><td />
                    <td className="n">{n(f.totales.planDir)}</td><td className="n">{n(f.totales.planTotal)}</td>
                    <td className="n">{n(f.totales.metaTotal)}</td>
                    <td className="n">{f.meses.some((m) => m.realizado !== null && m.realizado !== undefined) ? n(f.meses.reduce((a, m) => a + (m.realizado || 0), 0)) : '–'}</td>
                    <td className="n">{pct(f.totales.foja)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ))}
      </section>
    </>
  );
}

// Cómo se reparte una semana de trabajo
function Reparto({ fila, varias, nombre }) {
  const d = fila.detalle;
  if (!d) return <section className="panel"><p>{fila.error}</p></section>;
  const horas = d.promedioPonderado || 1;
  const nas = d.horasNas / horas;
  const asig = d.horasAsignaciones / horas;
  const resto = Math.max(0, 1 - nas - asig);
  const dir = resto * d.pctDir / (d.pctDir + d.pctInd);
  const ind = resto - dir;
  const tramo = (v, clase, texto) => v > 0.001 && (
    <span className={clase} style={{ flex: v }} title={`${texto}: ${pct(v)}`}>{v > 0.08 ? pct(v, 0) : ''}</span>
  );

  return (
    <section className="panel" aria-label={`Reparto de la semana${varias ? ` en ${nombre}` : ''}`}>
      <div className="panel-cabeza">
        <h2>Una semana de {d.promedioPonderado} horas{varias ? ` en ${nombre}` : ''}</h2>
        <span className="chip">{TRAMOS[d.tramo]}</span>
      </div>
      <div className="reparto" role="img" aria-label={`Directa ${pct(dir)}, indirecta ${pct(ind)}, no asistencial ${pct(nas)}, asignaciones ${pct(asig)}`}>
        {tramo(dir, 'r-dir', 'Directa')}
        {tramo(ind, 'r-ind', 'Indirecta')}
        {tramo(nas, 'r-nas', 'No asistencial')}
        {tramo(asig, 'r-asig', 'Asignaciones')}
      </div>
      <div className="leyenda" style={{ marginBottom: 12 }}>
        <span><i className="muestra directa" />Directa</span>
        <span><i className="muestra indirecta" />Indirecta</span>
        <span><i className="muestra" style={{ background: '#8496a5' }} />No asistencial</span>
        <span><i className="muestra" style={{ background: '#7a4fa0' }} />Asignaciones</span>
      </div>
      <ul className="lista-simple">
        <li><span>No asistencial (NAS)</span><b className="num">{d.horasNas.toLocaleString('es-CL')} h</b></li>
        {fila.alertas.length > 0 && <li><span>Alertas</span><span>{fila.alertas.map((a) => <span key={a} className="chip alerta">{a}</span>)}</span></li>}
        <li><span>Asignaciones especiales</span><b className="num">{d.horasAsignaciones.toLocaleString('es-CL')} h</b></li>
        {d.horasColacion > 0 && <li><span>Colación en contrato</span><b className="num">{d.horasColacion.toLocaleString('es-CL')} h</b></li>}
        <li><span>Minutos por atención directa</span><b className="num">{d.stdMinutosDirecta} min</b></li>
        {d.pctGrupal > 0 && <li><span>Atención grupal</span><b className="num">{pct(d.pctGrupal, 0)}, {d.pacientesPorGrupo} pacientes por grupo</b></li>}
      </ul>
    </section>
  );
}
