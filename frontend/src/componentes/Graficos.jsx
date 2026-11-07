// ------------------------------------------------------------
// Gráficos hechos con HTML (sin librerías): se pueden recorrer
// con teclado, leer con lector de pantalla y ver como tabla.
// ------------------------------------------------------------
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MESES, MESES_LARGO, n, pct } from '../api';

// Año completo: barras apiladas (directa + indirecta) por mes y línea de meta
export function GraficoAnio({ meses, mesElegido, alElegir }) {
  const [activo, setActivo] = useState(null);
  const [comoTabla, setComoTabla] = useState(false);
  const maximo = Math.max(1, ...meses.map((m) => Math.max(m.planDir + m.planInd, m.realizado || 0)));
  const hayReal = (m) => m.realizado !== null && m.realizado !== undefined;

  return (
    <div>
      <div className="panel-cabeza">
        <div className="leyenda" aria-hidden={comoTabla}>
          <span><i className="muestra directa" />Atención directa</span>
          <span><i className="muestra indirecta" />Atención indirecta</span>
          <span><i className="muestra meta" />Meta de Gestión</span>
          {meses.some((m) => m.realizado !== null && m.realizado !== undefined) && <span><i className="muestra real" />Realizado SIC</span>}
        </div>
        <button type="button" className="enlace-boton cambiar-vista" onClick={() => setComoTabla(!comoTabla)}>
          {comoTabla ? 'Ver gráfico' : 'Ver como tabla'}
        </button>
      </div>

      {comoTabla ? (
        <div className="tabla-envoltura">
          <table>
            <caption>Atenciones planificadas por mes</caption>
            <thead><tr><th>Mes</th><th className="n">Directas</th><th className="n">Indirectas</th><th className="n">Total</th><th className="n">Meta</th><th className="n">Realizado SIC</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td>{MESES_LARGO[m.mes - 1]}</td>
                  <td className="n">{n(m.planDir)}</td><td className="n">{n(m.planInd)}</td>
                  <td className="n">{n(m.planDir + m.planInd)}</td><td className="n">{n(m.metaTotal)}</td>
                  <td className="n">{hayReal(m) ? n(m.realizado) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="anio" role="group" aria-label="Atenciones planificadas por mes">
            {meses.map((m) => {
              const total = m.planDir + m.planInd;
              const altoDir = (m.planDir / maximo) * 100;
              const altoInd = (m.planInd / maximo) * 100;
              const elegido = mesElegido === m.mes;
              const atenuado = mesElegido && !elegido;
              return (
                <button
                  type="button"
                  key={m.mes}
                  className={`anio-mes ${elegido ? 'elegido' : ''} ${atenuado ? 'atenuado' : ''}`}
                  style={{ cursor: alElegir ? 'pointer' : 'default' }}
                  onMouseEnter={() => setActivo(m.mes)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(m.mes)}
                  onBlur={() => setActivo(null)}
                  onClick={() => alElegir && alElegir(elegido ? null : m.mes)}
                  aria-label={`${MESES_LARGO[m.mes - 1]}: ${n(total)} atenciones, ${n(m.planDir)} directas y ${n(m.planInd)} indirectas. Meta ${n(m.metaTotal)}.${hayReal(m) ? ` Realizado según SIC ${n(m.realizado)}.` : ''}`}
                  aria-pressed={alElegir ? elegido : undefined}
                >
                  <div className="anio-barra" style={{ height: `${altoDir + altoInd}%` }}>
                    {m.planInd > 0 && <div className="seg-ind" style={{ flex: m.planInd }} />}
                    {m.planDir > 0 && <div className="seg-dir" style={{ flex: m.planDir, borderRadius: m.planInd > 0 ? 0 : '4px 4px 0 0' }} />}
                  </div>
                  <div className="anio-meta" style={{ bottom: `${(m.metaTotal / maximo) * 100}%` }} />
                  {hayReal(m) && <div className="anio-real" style={{ bottom: `${(m.realizado / maximo) * 100}%` }} />}
                  {activo === m.mes && (
                    <div className="burbuja" role="presentation">
                      <b>{MESES_LARGO[m.mes - 1]}</b><br />
                      {n(total)} atenciones<br />
                      <span style={{ color: '#ff8f9c' }}>■</span> {n(m.planDir)} directas<br />
                      <span style={{ color: '#9fc2f2' }}>■</span> {n(m.planInd)} indirectas<br />
                      Meta {n(m.metaTotal)}
                      {hayReal(m) && <><br />Realizado {n(m.realizado)}</>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="anio-eje" />
          <div className="anio-etiquetas" aria-hidden="true">
            {MESES.map((m) => <span key={m}>{m}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

// Barras horizontales: meta por grupo (directa + indirecta).
// Cada fila: { clave, nombre, metaTotal, planDir, planTotal, enlace? }
export function BarrasMeta({ filas }) {
  const maximo = Math.max(1, ...filas.map((f) => f.metaTotal));
  return (
    <div className="barras-h">
      {filas.map((f) => {
        const proporcionDir = f.planTotal ? f.planDir / f.planTotal : 0;
        const ancho = (f.metaTotal / maximo) * 100;
        return (
          <Fila
            key={f.clave}
            enlace={f.enlace}
            etiqueta={`${f.nombre}: meta ${n(f.metaTotal)} atenciones${f.enlace ? '. Ver detalle' : ''}`}
          >
            <span className="nombre">{f.nombre}</span>
            <span className="pista-h" style={{ width: `${ancho}%` }}>
              <span style={{ flex: proporcionDir }} />
              <span style={{ flex: 1 - proporcionDir }} />
            </span>
            <span className="valor">{n(f.metaTotal)}</span>
          </Fila>
        );
      })}
    </div>
  );
}

// Fila con enlace (si tiene) o sin enlace
function Fila({ enlace, etiqueta, children }) {
  if (enlace) return <Link to={enlace} className="barra-h" aria-label={etiqueta}>{children}</Link>;
  return <div className="barra-h" aria-label={etiqueta} role="img">{children}</div>;
}

// Indicador pequeño de % FOJA con barra
export function Foja({ valor }) {
  if (valor === null || valor === undefined) return <span>–</span>;
  return (
    <span className="foja">
      <span className="num">{pct(valor)}</span>
      <span className="foja-pista" aria-hidden="true"><span style={{ width: `${Math.min(100, valor * 100)}%` }} /></span>
    </span>
  );
}
