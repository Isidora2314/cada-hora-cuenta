// ------------------------------------------------------------
// Detalle de un instituto: el mismo panorama filtrado + la lista
// de profesionales con su meta y alertas.
// ------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, n, pct, nombreEsp, cargoBonito, MESES } from '../api';
import { useSesion } from '../sesion';
import Dashboard from './Dashboard';
import { Foja } from '../componentes/Graficos';

export default function Instituto() {
  const { it } = useParams();
  const { sesion } = useSesion();
  const navegar = useNavigate();
  const [filas, setFilas] = useState(null);
  const [nombre, setNombre] = useState('');
  const [buscar, setBuscar] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);

  useEffect(() => {
    setFilas(null);
    api(`/planificacion?it=${it}`).then(setFilas).catch(() => setFilas([]));
    api('/institutos').then((l) => setNombre(l.find((i) => i.it === Number(it))?.nombre || `IT ${it}`)).catch(() => {});
  }, [it]);

  const visibles = useMemo(() => {
    if (!filas) return [];
    const q = buscar.trim().toLowerCase();
    return filas
      .filter((f) => !soloAlertas || f.alertas.length > 0)
      .filter((f) => !q || String(f.personaId).includes(q) || f.cargo.toLowerCase().includes(q) || nombreEsp(f.codEsp).toLowerCase().includes(q))
      .sort((a, b) => (b.totales?.metaTotal || 0) - (a.totales?.metaTotal || 0));
  }, [filas, buscar, soloAlertas]);

  const esJefatura = sesion.usuario.rol === 'JEFATURA';
  const migas = !esJefatura && (
    <nav className="migas" aria-label="Ruta"><Link to="/dashboard">Panorama nacional</Link> / {nombre}</nav>
  );

  return (
    <>
      <Dashboard itFijo={Number(it)} titulo={`Instituto ${nombre}`} migas={migas} />

      <section className="panel" style={{ marginTop: 18 }} aria-labelledby="t-prof">
        <div className="panel-cabeza">
          <div>
            <h2 id="t-prof">Profesionales</h2>
            <p>Cada fila es un profesional en un período de jornada. Selecciona una para ver su detalle mes a mes.</p>
          </div>
          <div className="filtros" style={{ margin: 0 }}>
            <div className="campo">
              <label htmlFor="buscar">Buscar</label>
              <input id="buscar" type="search" placeholder="PersonaId, cargo o especialidad" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '.9rem', paddingBottom: 8 }}>
              <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
              Solo con alertas
            </label>
          </div>
        </div>

        {!filas ? <p className="cargando">Cargando profesionales…</p> : (
          <div className="tabla-envoltura">
            <table>
              <caption>{visibles.length} de {filas.length} filas</caption>
              <thead>
                <tr>
                  <th>PersonaId</th><th>Cargo</th><th>Especialidad</th><th>Período</th>
                  <th className="n">Prom. h/sem</th><th className="n">Planificadas</th><th className="n">Meta</th>
                  <th>% FOJA</th><th className="n">Cumpl. SIC</th><th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.filaId} className="clic" onClick={() => navegar(`/profesional/${f.personaId}`)}>
                    <td><Link to={`/profesional/${f.personaId}`} onClick={(e) => e.stopPropagation()}>{f.personaId}</Link></td>
                    <td>{cargoBonito(f.cargo)}</td>
                    <td>{nombreEsp(f.codEsp)}</td>
                    <td className="num">{f.desde === 1 && f.hasta === 12 ? 'Todo el año' : `${MESES[f.desde - 1]} a ${MESES[f.hasta - 1].toLowerCase()}`}</td>
                    <td className="n">{f.detalle ? f.detalle.promedioPonderado : '–'}</td>
                    <td className="n">{n(f.totales?.planTotal)}</td>
                    <td className="n"><b>{n(f.totales?.metaTotal)}</b></td>
                    <td><Foja valor={f.totales?.foja} /></td>
                    <td className="n">{f.totales?.cumplimiento === undefined || f.totales?.cumplimiento === null ? '–'
                      : f.totales.cumplimiento < 0.9 ? <span className="chip alerta">{pct(f.totales.cumplimiento, 0)}</span> : pct(f.totales.cumplimiento, 0)}</td>
                    <td>{f.alertas.map((a) => <span key={a} className="chip alerta">{a}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
