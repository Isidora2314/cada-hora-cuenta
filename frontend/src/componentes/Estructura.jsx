// ------------------------------------------------------------
// Menú lateral + área de contenido. El menú muestra SOLO las
// opciones que el backend autorizó para el rol del usuario.
// ------------------------------------------------------------
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../sesion';
import { NOMBRE_ROL } from '../api';
import Logo from './Logo';

// Íconos simples (trazos), uno por sección
const trazos = {
  dashboard: 'M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-4H4z',
  instituto: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  parametros: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  cambios: 'M4 7h13l-3-3M20 17H7l3 3',
  asignaciones: 'M9 11l2 2 4-4M5 4h14v16H5z',
  versiones: 'M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  usuarios: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 9a6 6 0 0 1 12 0M17 11a3 3 0 0 0 0-6M21 20a6 6 0 0 0-4-5.6',
  auditoria: 'M8 4h8l4 4v12H4V4zM8 12h8M8 16h5',
  bot: 'M7 8h10v10H7zM12 4v4M9 13h0M15 13h0M4 12h3M17 12h3',
};
const Icono = ({ nombre }) => (
  <svg className="menu-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={trazos[nombre]} />
  </svg>
);

// Cada opción del menú (clave que envía el backend -> ruta, texto e ícono)
function opcionesDe(usuario, menu) {
  const catalogo = {
    // La jefatura ve el panorama dentro de "Mi instituto"
    'dashboard': usuario.rol === 'JEFATURA' ? null : { ruta: '/dashboard', texto: 'Panorama nacional', icono: 'dashboard' },
    'profesionales': usuario.rol === 'JEFATURA'
      ? { ruta: `/instituto/${usuario.it}`, texto: 'Mi instituto', icono: 'instituto' }
      : null,
    'mi-planificacion': { ruta: `/profesional/${usuario.personaId}`, texto: 'Mi planificación', icono: 'persona' },
    'parametros': { ruta: '/parametros', texto: 'Parámetros', icono: 'parametros' },
    'simulacion': null, // la simulación vive dentro de Parámetros
    'cambios': { ruta: '/cambios', texto: 'Cambios de BUK', icono: 'cambios' },
    'asignaciones': { ruta: '/pronto/asignaciones', texto: 'Asignaciones', icono: 'asignaciones', pronto: true },
    'versiones': { ruta: '/pronto/versiones', texto: 'Versiones', icono: 'versiones', pronto: true },
    'usuarios': { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuarios' },
    'auditoria': { ruta: '/auditoria', texto: 'Auditoría', icono: 'auditoria' },
    'estado-bot': { ruta: '/robot', texto: 'Robot Blue Prism', icono: 'bot' },
  };
  // (La jefatura también ve el panorama, pero el backend lo filtra a su instituto)
  return menu.map((clave) => catalogo[clave]).filter(Boolean);
}

export default function Estructura() {
  const { sesion, salir } = useSesion();
  const { usuario, menu } = sesion;
  const [lecturaFacil, setLecturaFacil] = useState(document.documentElement.classList.contains('lectura-facil'));

  function alternarLectura() {
    const nuevo = !lecturaFacil;
    setLecturaFacil(nuevo);
    document.documentElement.classList.toggle('lectura-facil', nuevo);
    try { localStorage.setItem('chc_lectura_facil', nuevo ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }

  return (
    <div className="app">
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <aside className="menu" aria-label="Menú principal">
        <div className="marca">
          <Logo />
          <div>
            <div className="marca-nombre">Cada hora cuenta</div>
            <div className="marca-sub">Planificación asistencial 2026</div>
          </div>
        </div>

        <nav>
          <ul>
            {opcionesDe(usuario, menu).map((o) => (
              <li key={o.ruta}>
                <NavLink to={o.ruta} className={({ isActive }) => [isActive ? 'activo' : '', o.pronto ? 'pronto' : ''].join(' ')}>
                  <Icono nombre={o.icono} />
                  {o.texto}
                  {o.pronto && <span className="etiqueta-pronto">pronto</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="menu-pie">
          <button type="button" className="interruptor" aria-pressed={lecturaFacil} onClick={alternarLectura}>
            Lectura fácil
            <span className="pista" aria-hidden="true" />
          </button>
          <div className="usuario">
            <div className="usuario-nombre">{usuario.nombre}</div>
            <div className="usuario-rol">{NOMBRE_ROL[usuario.rol]}</div>
          </div>
          <button type="button" className="boton-salir" onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
