// Secciones que se construyen en las próximas etapas
import { useParams } from 'react-router-dom';

const SECCIONES = {
  'cambios': ['Cambios detectados en BUK', 'Aquí aparecerán las altas, bajas y cambios de jornada que detecte el robot de Blue Prism, para revisarlos y aplicarlos desde su fecha de vigencia.'],
  'estado-bot': ['Robot Blue Prism', 'Aquí verás la última carga de BUK y SIC, cuántos registros se procesaron y los errores encontrados en cada reporte.'],
  'asignaciones': ['Asignaciones especiales', 'Aquí las jefaturas solicitarán asignaciones y la Dirección Médica Nacional las aprobará o rechazará.'],
  'versiones': ['Versiones de la planificación', 'Aquí se guardarán las versiones aprobadas, para saber siempre cuál es la vigente.'],
  'auditoria': ['Registro de auditoría', 'Aquí verás quién cambió qué, cuándo y por qué.'],
};

export default function Proximamente() {
  const { seccion } = useParams();
  const [titulo, texto] = SECCIONES[seccion] || ['Sección en construcción', ''];
  return (
    <div className="panel vacio">
      <h2>{titulo}</h2>
      <p style={{ maxWidth: '56ch', margin: '0 auto' }}>{texto}</p>
      <p style={{ marginTop: 12 }}><span className="chip">En construcción</span></p>
    </div>
  );
}
