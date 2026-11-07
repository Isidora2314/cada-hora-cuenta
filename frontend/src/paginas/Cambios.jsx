// ------------------------------------------------------------
// Cambios detectados por Blue Prism en el reporte de BUK.
// Planificación los revisa y los aplica (o descarta) uno a uno o todos.
// Cada cambio rige desde su mes de vigencia: los meses anteriores no cambian.
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, n, MESES_LARGO, cargoBonito } from '../api';
import { useSesion } from '../sesion';

export const TIPOS = {
  ALTA: { texto: 'Alta', clase: 'ok' },
  NUEVO_REEMPLAZO: { texto: 'Nuevo reemplazo', clase: 'ok' },
  BAJA: { texto: 'Baja', clase: 'alerta' },
  CAMBIO_JORNADA: { texto: 'Cambio de jornada', clase: 'info' },
  CAMBIO_CARGO: { texto: 'Cambio de cargo', clase: 'info' },
  CAMBIO_VIGENCIA: { texto: 'Cambio de vigencia', clase: 'info' },
};
const mesTexto = (vigencia) => `${MESES_LARGO[Number(vigencia.slice(5, 7)) - 1]} ${vigencia.slice(0, 4)}`;

export default function Cambios() {
  const { sesion } = useSesion();
  const puedeAplicar = sesion.usuario.rol === 'PLANIFICADOR';
  const [vista, setVista] = useState('PENDIENTE');
  const [cambios, setCambios] = useState(null);
  const [estado, setEstado] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [descartando, setDescartando] = useState(null); // id del cambio que se está descartando
  const [motivo, setMotivo] = useState('');

  const cargar = () => {
    setCambios(null);
    api(`/cambios?estado=${vista}`).then(setCambios).catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
    api('/cargas').then(setEstado).catch(() => {});
  };
  useEffect(cargar, [vista]);

  async function aplicar(c) {
    setOcupado(true); setMensaje(null);
    try {
      const r = await api(`/cambios/${c.id}/aplicar`, { metodo: 'POST', datos: {} });
      setMensaje({ tipo: 'ok', texto: `Cambio aplicado a ${c.personaId} desde ${mesTexto(c.vigencia)}. Meta anual: ${n(r.impacto.metaAntes)} → ${n(r.impacto.metaDespues)}.` });
      cargar();
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); } finally { setOcupado(false); }
  }

  async function aplicarTodos() {
    setOcupado(true); setMensaje(null);
    try {
      const r = await api('/cambios/aplicar-todos', { metodo: 'POST', datos: {} });
      setMensaje({ tipo: 'ok', texto: `${r.aplicados} cambios aplicados. La Meta de Gestión nacional cambió en ${r.diferenciaMeta >= 0 ? '+' : ''}${n(r.diferenciaMeta)} atenciones.` });
      cargar();
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); } finally { setOcupado(false); }
  }

  async function descartar(c) {
    setOcupado(true); setMensaje(null);
    try {
      await api(`/cambios/${c.id}/descartar`, { metodo: 'POST', datos: { justificacion: motivo } });
      setMensaje({ tipo: 'ok', texto: `Cambio de ${c.personaId} descartado.` });
      setDescartando(null); setMotivo('');
      cargar();
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); } finally { setOcupado(false); }
  }

  const ultimaBuk = estado?.cargas.find((c) => c.tipo === 'BUK');
  const pendientes = vista === 'PENDIENTE' && cambios ? cambios.length : 0;
  const efectoTotal = vista === 'PENDIENTE' && cambios ? cambios.reduce((s, c) => s + (c.impacto?.diferencia || 0), 0) : 0;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Cambios detectados en BUK</h1>
          <p className="bajada">
            Blue Prism compara cada reporte nuevo con la dotación vigente y deja aquí solo lo que cambió.
            Al aplicar un cambio, la planificación se ajusta desde su mes de vigencia; los meses anteriores no se tocan.
          </p>
        </div>
        {ultimaBuk && (
          <div className="chip" style={{ padding: '6px 12px' }}>
            Último reporte: {ultimaBuk.archivo}, {new Date(ultimaBuk.fechaHora).toLocaleString('es-CL')}
          </div>
        )}
      </header>

      <div className="pestanas" role="tablist">
        {[['PENDIENTE', 'Por revisar'], ['TODOS', 'Historial']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)}>{t}</button>
        ))}
      </div>

      {mensaje && <div className={mensaje.tipo === 'ok' ? 'mensaje-ok' : 'mensaje-error'} role="status" style={{ marginBottom: 16 }}>{mensaje.texto}</div>}

      {vista === 'PENDIENTE' && pendientes > 0 && (
        <section className="portada" style={{ alignItems: 'center' }}>
          <div>
            <div className="portada-cifra num" style={{ fontSize: 'clamp(2.2rem, 4vw, 3rem)' }}>{pendientes}</div>
            <p className="portada-frase">cambios por revisar del último reporte</p>
            <p className="portada-detalle">
              Si se aplican todos, la Meta de Gestión nacional cambia en <b className="num">{efectoTotal >= 0 ? '+' : ''}{n(efectoTotal)}</b> atenciones.
            </p>
          </div>
          {puedeAplicar && <button type="button" className="boton" onClick={aplicarTodos} disabled={ocupado}>Aplicar todos los cambios</button>}
        </section>
      )}

      {!cambios ? <p className="cargando">Cargando cambios…</p> : cambios.length === 0 ? (
        <div className="panel vacio">
          <h2>{vista === 'PENDIENTE' ? 'No hay cambios por revisar' : 'Aún no hay cambios'}</h2>
          <p>Cuando Blue Prism procese un reporte nuevo de BUK, las altas, bajas y cambios de jornada aparecerán aquí.</p>
          <p style={{ marginTop: 10 }}><Link to="/robot">Ver el estado del robot</Link></p>
        </div>
      ) : (
        <section className="panel">
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th><th>Profesional</th><th>Qué cambió</th><th>Rige desde</th>
                  <th className="n">{vista === 'PENDIENTE' ? 'Efecto en su meta anual' : 'Efecto aplicado'}</th>
                  <th>{vista === 'PENDIENTE' ? <span className="oculto-visual">Acciones</span> : 'Estado'}</th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => {
                  const impacto = c.impacto || c.impactoAplicado;
                  return (
                    <tr key={c.id}>
                      <td><span className={`chip ${TIPOS[c.tipo]?.clase || ''}`}>{TIPOS[c.tipo]?.texto || c.tipo}</span></td>
                      <td>
                        <Link to={`/profesional/${c.personaId}`}>{c.personaId}</Link>
                        <div style={{ fontSize: '.82rem', color: 'var(--texto-3)' }}>{cargoBonito(c.cargo)}, {c.nombreInstituto}</div>
                      </td>
                      <td style={{ maxWidth: 360 }}>{c.descripcion}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{mesTexto(c.vigencia)}</td>
                      <td className="n">
                        {impacto ? (
                          <>
                            <b className={impacto.diferencia >= 0 ? 'texto-sube' : 'texto-baja'}>{impacto.diferencia >= 0 ? '+' : ''}{n(impacto.diferencia)}</b>
                            <div style={{ fontSize: '.8rem', color: 'var(--texto-3)' }}>{n(impacto.metaAntes)} → {n(impacto.metaDespues)}</div>
                          </>
                        ) : '–'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {c.estado === 'PENDIENTE' && puedeAplicar ? (
                          descartando === c.id ? (
                            <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
                              <label htmlFor={`m-${c.id}`} className="oculto-visual">Motivo para descartar</label>
                              <input id={`m-${c.id}`} placeholder="¿Por qué se descarta?" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                                style={{ border: '1px solid var(--borde-fuerte)', borderRadius: 6, padding: '6px 8px' }} />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" className="boton chico" disabled={!motivo.trim() || ocupado} onClick={() => descartar(c)}>Descartar</button>
                                <button type="button" className="boton secundario chico" onClick={() => { setDescartando(null); setMotivo(''); }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="boton chico" disabled={ocupado} onClick={() => aplicar(c)}>Aplicar</button>
                              <button type="button" className="boton secundario chico" onClick={() => setDescartando(c.id)}>Descartar</button>
                            </div>
                          )
                        ) : (
                          <span className={`chip ${c.estado === 'APLICADO' ? 'ok' : ''}`}>{c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
