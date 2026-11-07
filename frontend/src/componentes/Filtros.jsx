// ------------------------------------------------------------
// Fila de filtros del dashboard (instituto, especialidad, mes)
// ------------------------------------------------------------
import { MESES_LARGO, nombreEsp } from '../api';

export default function Filtros({ valores, cambiar, institutos, especialidades, mostrarInstituto = true }) {
  return (
    <div className="filtros" role="search" aria-label="Filtros">
      {mostrarInstituto && (
        <div className="campo">
          <label htmlFor="f-it">Instituto</label>
          <select id="f-it" value={valores.it || ''} onChange={(e) => cambiar({ ...valores, it: e.target.value || null })}>
            <option value="">Todos los institutos</option>
            {institutos.map((i) => <option key={i.it} value={i.it}>{i.nombre}</option>)}
          </select>
        </div>
      )}
      <div className="campo">
        <label htmlFor="f-esp">Especialidad</label>
        <select id="f-esp" value={valores.codEsp || ''} onChange={(e) => cambiar({ ...valores, codEsp: e.target.value || null })}>
          <option value="">Todas las especialidades</option>
          {especialidades.map((c) => <option key={c} value={c}>{nombreEsp(c)}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-mes">Período</label>
        <select id="f-mes" value={valores.mes || ''} onChange={(e) => cambiar({ ...valores, mes: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Todo 2026</option>
          {MESES_LARGO.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
      </div>
      {((mostrarInstituto && valores.it) || valores.codEsp || valores.mes) && (
        <button type="button" className="boton secundario chico" onClick={() => cambiar({ it: mostrarInstituto ? null : valores.it, codEsp: null, mes: null })}>
          Quitar filtros
        </button>
      )}
    </div>
  );
}
