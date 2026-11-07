// ------------------------------------------------------------
// Parámetros del cálculo. El PLANIFICADOR puede editarlos:
//   1) cambia valores  2) "Simular impacto" (no guarda)
//   3) escribe la justificación y "Guardar cambio" (queda en auditoría)
// Los demás roles los ven en modo lectura.
// ------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { api, n, pct, nombreEsp, cargoBonito } from '../api';
import { useSesion } from '../sesion';

const TRAMOS = [
  { clave: 'mayorIgual40', texto: '40 h o más' },
  { clave: 'entre22y40', texto: '22 a 40 h' },
  { clave: 'menor22', texto: 'Menos de 22 h' },
];

// Qué parámetros generales se muestran y cómo
const GENERALES = {
  porcentajeMetaGestion: { texto: 'Meta de Gestión', tipo: 'pct' },
  maxAsignacionesSobre30h: { texto: 'Máximo de asignaciones (más de 30 h)', tipo: 'num' },
  stdMinutosIndirecta: { texto: 'Minutos por atención indirecta', tipo: 'num' },
  diasVacaciones: { texto: 'Días de vacaciones', tipo: 'num' },
  diasAdministrativos: { texto: 'Días administrativos', tipo: 'num' },
  diaCumpleanios: { texto: 'Día de cumpleaños', tipo: 'num' },
  umbralAlertaDesviacion: { texto: 'Alerta de desviación SIC', tipo: 'pct' },
};

export default function Parametros() {
  const { sesion } = useSesion();
  const puedeEditar = sesion.usuario.rol === 'PLANIFICADOR';
  const [tablas, setTablas] = useState(null);
  const [pestana, setPestana] = useState('distribucion');
  const [elegido, setElegido] = useState(null); // { tabla, clave, fila }
  const [buscar, setBuscar] = useState('');

  const cargar = () => api('/parametros').then(setTablas);
  useEffect(() => { cargar(); }, []);

  const cargos = useMemo(() => {
    if (!tablas) return [];
    const q = buscar.trim().toLowerCase();
    return tablas.distribucion.filter((d) => !q || d.cargo.toLowerCase().includes(q) || (d.unidad || '').toLowerCase().includes(q));
  }, [tablas, buscar]);

  if (!tablas) return <p className="cargando">Cargando parámetros…</p>;

  const elegir = (tabla, clave, fila) => setElegido({ tabla, clave, fila });

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Parámetros del cálculo</h1>
          <p className="bajada">
            Las reglas que antes estaban escondidas en el Excel. {puedeEditar
              ? 'Puedes simular el impacto de un cambio antes de guardarlo; cada cambio queda registrado con su justificación.'
              : 'Estás en modo lectura: solo Planificación central puede modificarlos.'}
          </p>
        </div>
      </header>

      <div className="pestanas" role="tablist" aria-label="Tipo de parámetro">
        {[['distribucion', 'Distribución por cargo'], ['generales', 'Reglas generales'], ['grupal', 'Atención grupal']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={pestana === k} onClick={() => { setPestana(k); setElegido(null); }}>{t}</button>
        ))}
      </div>

      <div className="editor">
        <section className="panel" role="tabpanel">
          {pestana === 'distribucion' && (
            <>
              <div className="panel-cabeza">
                <p>% de la semana para atención directa, indirecta y no asistencial, según cargo y tramo de jornada.</p>
                <div className="campo">
                  <label htmlFor="b-cargo">Buscar cargo</label>
                  <input id="b-cargo" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej: kinesiologo" />
                </div>
              </div>
              <div className="tabla-envoltura" style={{ maxHeight: 560, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cargo</th><th className="n">Min. directa</th>
                      {TRAMOS.map((t) => <th key={t.clave} className="n" style={{ whiteSpace: 'nowrap' }}>{t.texto}<br /><span style={{ fontWeight: 400 }}>% dir / ind / NAS</span></th>)}
                      <th><span className="oculto-visual">Acción</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargos.map((d) => (
                      <tr key={d.cargo} style={elegido?.clave === d.cargo ? { background: 'var(--directa-claro)' } : undefined}>
                        <td>{cargoBonito(d.cargo)}<div style={{ fontSize: '.78rem', color: 'var(--texto-3)' }}>{d.unidad}</div></td>
                        <td className="n">{d.stdMinutosDirecta}</td>
                        {TRAMOS.map((t) => {
                          const x = d.tramos[t.clave];
                          return <td key={t.clave} className="n nowrap">{Math.round(x.dir * 100)} / {Math.round((x.ind || 0) * 100)} / {Math.round(x.nas * 100)}</td>;
                        })}
                        <td><button type="button" className="boton secundario chico" onClick={() => elegir('distribucion', d.cargo, d)}>{puedeEditar ? 'Editar' : 'Ver'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pestana === 'generales' && (
            <table>
              <thead><tr><th>Regla</th><th className="n">Valor</th><th><span className="oculto-visual">Acción</span></th></tr></thead>
              <tbody>
                {tablas.parametros_generales.filter((g) => GENERALES[g.clave]).map((g) => (
                  <tr key={g.clave}>
                    <td>{GENERALES[g.clave].texto}<div style={{ fontSize: '.8rem', color: 'var(--texto-3)' }}>{g.descripcion}</div></td>
                    <td className="n"><b>{GENERALES[g.clave].tipo === 'pct' ? pct(g.valor, 0) : g.valor}</b></td>
                    <td><button type="button" className="boton secundario chico" onClick={() => elegir('parametros_generales', g.clave, g)}>{puedeEditar ? 'Editar' : 'Ver'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pestana === 'grupal' && (
            <table>
              <caption>Áreas que atienden en grupo: parte del tiempo directo se multiplica por los pacientes de cada grupo.</caption>
              <thead><tr><th>Especialidad</th><th className="n">% grupal</th><th className="n">Pacientes Santiago y Concepción</th><th className="n">Pacientes otros institutos</th><th /></tr></thead>
              <tbody>
                {tablas.factor_grupal.map((g) => (
                  <tr key={g.codEsp}>
                    <td>{nombreEsp(g.codEsp)}</td>
                    <td className="n">{pct(g.porcentajeGrupal, 0)}</td>
                    <td className="n">{g.pacientesSanCon}</td>
                    <td className="n">{g.pacientesOtrosIT}</td>
                    <td><button type="button" className="boton secundario chico" onClick={() => elegir('factor_grupal', g.codEsp, g)}>{puedeEditar ? 'Editar' : 'Ver'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="editor-panel">
          {elegido
            ? <Editor key={`${elegido.tabla}-${elegido.clave}`} {...elegido} puedeEditar={puedeEditar} alGuardar={() => { cargar(); }} />
            : (
              <div className="panel vacio">
                <h2>Elige un parámetro</h2>
                <p>{puedeEditar ? 'Usa "Editar" en la tabla para cambiar un valor y simular su impacto en la Meta de Gestión.' : 'Usa "Ver" para revisar el detalle.'}</p>
              </div>
            )}
        </aside>
      </div>
    </>
  );
}

// Campo de porcentaje: se muestra 0-100 y se guarda 0-1
function CampoPct({ valor, alCambiar, etiqueta, deshabilitado }) {
  return (
    <input type="number" min="0" max="100" step="1" aria-label={etiqueta} disabled={deshabilitado}
      value={Math.round((valor || 0) * 1000) / 10} onChange={(e) => alCambiar(Number(e.target.value) / 100)} />
  );
}

// Panel para editar, simular y guardar un parámetro
function Editor({ tabla, clave, fila, puedeEditar, alGuardar }) {
  const [valores, setValores] = useState(() => JSON.parse(JSON.stringify(fila)));
  const [justificacion, setJustificacion] = useState('');
  const [simulacion, setSimulacion] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // Lo que se envía al backend (solo lo editable)
  const cambios = () => {
    if (tabla === 'distribucion') return { stdMinutosDirecta: Number(valores.stdMinutosDirecta), tramos: valores.tramos };
    if (tabla === 'parametros_generales') return { valor: Number(valores.valor) };
    return { porcentajeGrupal: Number(valores.porcentajeGrupal), pacientesSanCon: Number(valores.pacientesSanCon), pacientesOtrosIT: Number(valores.pacientesOtrosIT) };
  };

  async function simular() {
    setOcupado(true); setMensaje(null);
    try { setSimulacion(await api('/simulaciones', { metodo: 'POST', datos: { tabla, clave, valores: cambios() } })); }
    catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
    finally { setOcupado(false); }
  }

  async function guardar() {
    setOcupado(true); setMensaje(null);
    try {
      await api(`/parametros/${tabla}/${encodeURIComponent(clave)}`, { metodo: 'PUT', datos: { valores: cambios(), justificacion } });
      setMensaje({ tipo: 'ok', texto: 'Cambio guardado. La planificación ya usa el nuevo valor.' });
      setJustificacion('');
      setSimulacion(null);
      alGuardar();
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
    finally { setOcupado(false); }
  }

  const titulo = tabla === 'distribucion' ? cargoBonito(clave) : tabla === 'factor_grupal' ? nombreEsp(clave) : (GENERALES[clave]?.texto || clave);
  const deshabilitado = !puedeEditar;


  return (
    <section className="panel" aria-labelledby="t-editor">
      <h2 id="t-editor">{titulo}</h2>

      {tabla === 'distribucion' && (
        <>
          <div className="campo" style={{ marginTop: 12 }}>
            <label htmlFor="std">Minutos por atención directa</label>
            <input id="std" type="number" min="5" step="5" disabled={deshabilitado} value={valores.stdMinutosDirecta}
              onChange={(e) => setValores({ ...valores, stdMinutosDirecta: e.target.value })} />
          </div>
          <div className="tramos" role="group" aria-label="Porcentajes por tramo">
            <span /><span className="t">Directa %</span><span className="t">Indirecta %</span><span className="t">NAS %</span>
            {TRAMOS.map((t) => {
              const x = valores.tramos[t.clave];
              const cambiar = (campo) => (v) => setValores({ ...valores, tramos: { ...valores.tramos, [t.clave]: { ...x, [campo]: v } } });
              const suma = (x.dir || 0) + (x.ind || 0) + (x.nas || 0);
              return [
                <span key={`${t.clave}-l`} className="t">{t.texto}{Math.abs(suma - 1) > 0.001 && <div className="suma-mal">suma {pct(suma, 0)}</div>}</span>,
                <CampoPct deshabilitado={deshabilitado} key={`${t.clave}-d`} valor={x.dir} alCambiar={cambiar('dir')} etiqueta={`Directa ${t.texto}`} />,
                <CampoPct deshabilitado={deshabilitado} key={`${t.clave}-i`} valor={x.ind} alCambiar={cambiar('ind')} etiqueta={`Indirecta ${t.texto}`} />,
                <CampoPct deshabilitado={deshabilitado} key={`${t.clave}-n`} valor={x.nas} alCambiar={cambiar('nas')} etiqueta={`NAS ${t.texto}`} />,
              ];
            })}
          </div>
        </>
      )}

      {tabla === 'parametros_generales' && (
        <div className="campo" style={{ margin: '12px 0' }}>
          <label htmlFor="valor">{GENERALES[clave]?.tipo === 'pct' ? 'Valor (%)' : 'Valor'}</label>
          {GENERALES[clave]?.tipo === 'pct'
            ? <CampoPct deshabilitado={deshabilitado} valor={valores.valor} alCambiar={(v) => setValores({ ...valores, valor: v })} etiqueta="Valor en porcentaje" />
            : <input id="valor" type="number" disabled={deshabilitado} value={valores.valor} onChange={(e) => setValores({ ...valores, valor: e.target.value })} />}
          <span className="ayuda">{valores.descripcion}</span>
        </div>
      )}

      {tabla === 'factor_grupal' && (
        <div style={{ display: 'grid', gap: 10, margin: '12px 0' }}>
          <div className="campo"><span className="rotulo">% de atención grupal</span>
            <CampoPct deshabilitado={deshabilitado} valor={valores.porcentajeGrupal} alCambiar={(v) => setValores({ ...valores, porcentajeGrupal: v })} etiqueta="Porcentaje de atención grupal" /></div>
          <div className="campo"><label htmlFor="psc">Pacientes por grupo en Santiago y Concepción</label>
            <input id="psc" type="number" step="0.5" disabled={deshabilitado} value={valores.pacientesSanCon} onChange={(e) => setValores({ ...valores, pacientesSanCon: e.target.value })} /></div>
          <div className="campo"><label htmlFor="pot">Pacientes por grupo en otros institutos</label>
            <input id="pot" type="number" step="0.5" disabled={deshabilitado} value={valores.pacientesOtrosIT} onChange={(e) => setValores({ ...valores, pacientesOtrosIT: e.target.value })} /></div>
        </div>
      )}

      {puedeEditar && (
        <>
          <button type="button" className="boton secundario" onClick={simular} disabled={ocupado}>Simular impacto</button>

          {simulacion && (
            <div className="resultado-sim" aria-live="polite">
              <span className="rotulo" style={{ color: 'var(--texto-2)', fontSize: '.88rem' }}>Meta de Gestión nacional</span>
              <div className="num">{n(simulacion.nacional.antes.metaTotal)} → <b>{n(simulacion.nacional.despues.metaTotal)}</b></div>
              <div className={`delta num ${simulacion.nacional.diferenciaMeta >= 0 ? 'sube' : 'baja'}`}>
                {simulacion.nacional.diferenciaMeta >= 0 ? '+' : ''}{n(simulacion.nacional.diferenciaMeta)} atenciones
              </div>
              <span style={{ fontSize: '.88rem', color: 'var(--texto-2)' }}>
                {simulacion.institutosAfectados.length === 0
                  ? 'Ningún instituto cambia su meta.'
                  : `Cambia la meta de ${simulacion.institutosAfectados.length} institutos.`}
              </span>
            </div>
          )}

          <div className="campo" style={{ marginTop: 16 }}>
            <label htmlFor="just">Justificación del cambio</label>
            <textarea id="just" value={justificacion} onChange={(e) => setJustificacion(e.target.value)} placeholder="Ej: Acuerdo DMN del 10 de noviembre" />
            <span className="ayuda">Obligatoria. Queda registrada con tu nombre y la fecha.</span>
          </div>
          <button type="button" className="boton" style={{ marginTop: 12 }} onClick={guardar} disabled={ocupado || !justificacion.trim()}>Guardar cambio</button>
        </>
      )}
      {mensaje && <div className={mensaje.tipo === 'ok' ? 'mensaje-ok' : 'mensaje-error'} role="status" style={{ marginTop: 12 }}>{mensaje.texto}</div>}
    </section>
  );
}
