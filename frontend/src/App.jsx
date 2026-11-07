// ------------------------------------------------------------
// Rutas de la aplicación. Cada página revisa el rol en el backend;
// aquí solo se decide qué mostrar en el menú y a dónde redirigir.
// ------------------------------------------------------------
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './sesion';
import Estructura from './componentes/Estructura';
import Login from './paginas/Login';
import Dashboard from './paginas/Dashboard';
import Instituto from './paginas/Instituto';
import Profesional from './paginas/Profesional';
import Parametros from './paginas/Parametros';
import Usuarios from './paginas/Usuarios';
import Proximamente from './paginas/Proximamente';
import Cambios from './paginas/Cambios';
import Robot from './paginas/Robot';
import Auditoria from './paginas/Auditoria';

// Página de inicio según el rol
export function inicioDe(usuario) {
  if (!usuario) return '/login';
  if (usuario.rol === 'ADMIN') return '/usuarios';
  if (usuario.rol === 'PROFESIONAL') return `/profesional/${usuario.personaId}`;
  if (usuario.rol === 'JEFATURA') return `/instituto/${usuario.it}`;
  return '/dashboard';
}

export default function App() {
  const { sesion, cargando } = useSesion();
  if (cargando) return <p className="cargando" style={{ padding: 40 }}>Cargando…</p>;

  if (!sesion) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Estructura />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/instituto/:it" element={<Instituto />} />
        <Route path="/profesional/:personaId" element={<Profesional />} />
        <Route path="/parametros" element={<Parametros />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/cambios" element={<Cambios />} />
        <Route path="/robot" element={<Robot />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/pronto/:seccion" element={<Proximamente />} />
        <Route path="*" element={<Navigate to={inicioDe(sesion.usuario)} replace />} />
      </Route>
    </Routes>
  );
}
