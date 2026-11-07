// ------------------------------------------------------------
// Registro de auditoría: quién cambió qué, cuándo y por qué.
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { api } from '../api';

const ACCIONES = {
  LOGIN: 'Inicio de sesión', CREAR: 'Creó', EDITAR: 'Editó', DESACTIVAR: 'Desactivó',
  CARGA_BUK: 'Cargó reporte BUK', CARGA_SIC: 'Cargó reporte SIC',
  APLICAR_CAMBIO: 'Aplicó cambio', DESCARTAR_CAMBIO: 'Descartó cambio',
};

// Resume un objeto en texto corto
const resumen = (v) => {
  if (v === null || v === undefined) return '–';
  if (typeof v !== 'object') return String(v);
  const texto = Object.entries(v).filter(([k]) => !['passwordHash', 'tramos'].includes(k))
    .map(([k, x]) => `${k}: ${typeof x === 'object' && x !== null ? '…' : x}`).join(', ');
  return texto.length > 120 ? `${texto.slice(0, 120)}…` : texto;
};

export default function Auditoria() {
  const [log, setLog] = useState(null);
  const [soloCambios, setSoloCambios] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { api('/auditoria').then(setLog).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="mensaje-error" role="alert">{error}</div>;
  const visibles = (log || []).filter((x) => !soloCambios || x.accion !== 'LOGIN');

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Registro de auditoría</h1>
          <p className="bajada">Cada cambio queda guardado con quién lo hizo, cuándo, el valor anterior, el nuevo y la justificación.</p>
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} />
          Ocultar inicios de sesión
        </label>
      </header>
      <section className="panel">
        {!log ? <p className="cargando">Cargando…</p> : visibles.length === 0 ? <p style={{ color: 'var(--texto-2)' }}>Sin registros todavía.</p> : (
          <div className="tabla-envoltura">
            <table>
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Sobre</th><th>Antes</th><th>Después</th><th>Justificación</th></tr></thead>
              <tbody>
                {visibles.map((x) => (
                  <tr key={x.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(x.fechaHora).toLocaleString('es-CL')}</td>
                    <td>{x.usuario}<div style={{ fontSize: '.78rem', color: 'var(--texto-3)' }}>{x.rol}</div></td>
                    <td>{ACCIONES[x.accion] || x.accion}</td>
                    <td>{x.entidad}{x.idEntidad !== null ? ` ${x.idEntidad}` : ''}</td>
                    <td style={{ fontSize: '.85rem', maxWidth: 220 }}>{resumen(x.valorAnterior)}</td>
                    <td style={{ fontSize: '.85rem', maxWidth: 220 }}>{resumen(x.valorNuevo)}</td>
                    <td style={{ fontSize: '.85rem' }}>{x.justificacion || '–'}</td>
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
