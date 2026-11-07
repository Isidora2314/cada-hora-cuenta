// ------------------------------------------------------------
// Robot Blue Prism: qué hace, cuándo fue la última carga y
// qué errores encontró en cada reporte.
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, n } from '../api';

const PASOS = [
  ['Recibe', 'Toma los Excel de BUK (dotación) y SIC (atenciones) apenas llegan.'],
  ['Valida', 'Revisa columnas, fechas, horas, duplicados y códigos. Informa cada error con su fila.'],
  ['Compara', 'Detecta altas, bajas y cambios de jornada, cargo o vigencia, con su mes de inicio.'],
  ['Entrega', 'Envía al sistema solo lo que cambió. Planificación lo revisa y lo aplica.'],
];
const NOMBRES = { BUK: 'Dotación BUK', SIC: 'Atenciones SIC', VALIDACION_BOT: 'Validación del robot' };

export default function Robot() {
  const [datos, setDatos] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/cargas').then((d) => { setDatos(d); if (d.cargas[0]) setAbierta(d.cargas.find((c) => c.errores > 0)?.id || null); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="mensaje-error" role="alert">{error}</div>;
  if (!datos) return <p className="cargando">Cargando…</p>;

  const ultima = (tipo) => datos.cargas.find((c) => c.tipo === tipo);
  const buk = ultima('BUK');
  const sic = ultima('SIC');

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Robot Blue Prism</h1>
          <p className="bajada">
            El robot hace el trabajo repetitivo con los archivos. Las personas revisan, aprueban y deciden.
          </p>
        </div>
      </header>

      <ol className="flujo" aria-label="Qué hace el robot">
        {PASOS.map(([t, d], i) => (
          <li key={t}><span className="flujo-num" aria-hidden="true">{i + 1}</span><b>{t}</b><span>{d}</span></li>
        ))}
      </ol>

      <div className="grilla-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[['BUK', buk], ['SIC', sic]].map(([tipo, c]) => (
          <section className="panel" key={tipo} aria-label={`Última carga ${tipo}`}>
            <div className="panel-cabeza">
              <h2>{NOMBRES[tipo]}</h2>
              {c ? <span className={`chip ${c.errores ? 'alerta' : 'ok'}`}>{c.errores ? `${c.errores} errores` : 'Sin errores'}</span> : <span className="chip">Sin cargas</span>}
            </div>
            {c ? (
              <ul className="lista-simple">
                <li><span>Archivo</span><b>{c.archivo}</b></li>
                <li><span>Procesado</span><b>{new Date(c.fechaHora).toLocaleString('es-CL')}</b></li>
                <li><span>Meses del reporte</span><b>{c.periodos?.join(' a ') || '–'}</b></li>
                <li><span>Filas cargadas</span><b className="num">{n(c.resumen.cargados)} de {n(c.resumen.recibidos)}</b></li>
                {tipo === 'BUK' && <li><span>Cambios detectados</span><b className="num"><Link to="/cambios">{c.cambiosDetectados}</Link></b></li>}
              </ul>
            ) : <p style={{ color: 'var(--texto-2)' }}>Todavía no llega ningún reporte {tipo}. Ver docs/contrato-bot.md para conectar el robot.</p>}
          </section>
        ))}
      </div>

      <section className="panel" aria-labelledby="t-hist">
        <h2 id="t-hist" style={{ marginBottom: 10 }}>Historial de cargas</h2>
        {datos.cargas.length === 0 ? <p style={{ color: 'var(--texto-2)' }}>Sin cargas todavía.</p> : (
          <div className="tabla-envoltura">
            <table>
              <thead><tr><th>#</th><th>Reporte</th><th>Archivo</th><th>Fecha</th><th className="n">Filas cargadas</th><th className="n">Errores</th><th /></tr></thead>
              <tbody>
                {datos.cargas.map((c) => [
                  <tr key={c.id}>
                    <td className="num">{c.id}</td>
                    <td>{NOMBRES[c.tipo] || c.tipo}</td>
                    <td>{c.archivo}</td>
                    <td>{new Date(c.fechaHora).toLocaleString('es-CL')}</td>
                    <td className="n">{c.resumen.cargados !== undefined ? n(c.resumen.cargados) : '–'}</td>
                    <td className="n">{c.errores ? <span className="chip alerta">{c.errores}</span> : '0'}</td>
                    <td>{c.errores > 0 && (
                      <button type="button" className="enlace-boton" aria-expanded={abierta === c.id} onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                        {abierta === c.id ? 'Ocultar errores' : 'Ver errores'}
                      </button>
                    )}</td>
                  </tr>,
                  abierta === c.id && (
                    <tr key={`${c.id}-e`}>
                      <td colSpan={7} style={{ background: '#fbfbfc' }}>
                        <table>
                          <caption>Errores del reporte {c.archivo} (las filas con error no se cargaron)</caption>
                          <thead><tr><th className="n">Fila</th><th>Columna</th><th>Tipo</th><th>Valor</th><th>Qué pasó</th></tr></thead>
                          <tbody>
                            {c.listaErrores.map((e, i) => (
                              <tr key={i}>
                                <td className="n">{e.fila ?? '–'}</td><td>{e.columna}</td>
                                <td><span className="chip alerta">{e.tipo.replaceAll('_', ' ').toLowerCase()}</span></td>
                                <td>{e.valor === null || e.valor === undefined ? '–' : String(e.valor)}</td><td>{e.mensaje}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
