// ------------------------------------------------------------
// Administración de usuarios (solo ADMIN): crear, cambiar rol,
// asignar instituto o PersonaId y activar/desactivar.
// ------------------------------------------------------------
import { useEffect, useState } from 'react';
import { api, NOMBRE_ROL } from '../api';

const VACIO = { email: '', nombre: '', rol: 'PROFESIONAL', it: '', personaId: '', password: '' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState(null);
  const [institutos, setInstitutos] = useState([]);
  const [nuevo, setNuevo] = useState(VACIO);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () => api('/usuarios').then(setUsuarios).catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  useEffect(() => {
    cargar();
    api('/institutos').then(setInstitutos).catch(() => {});
  }, []);

  const nombreIT = (it) => institutos.find((i) => i.it === it)?.nombre || (it ? `IT ${it}` : '–');

  async function crear(e) {
    e.preventDefault();
    setMensaje(null);
    try {
      await api('/usuarios', { metodo: 'POST', datos: { ...nuevo, justificacion: 'Alta de usuario desde administración' } });
      setMensaje({ tipo: 'ok', texto: `Usuario ${nuevo.email} creado.` });
      setNuevo(VACIO);
      cargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  async function alternarActivo(u) {
    setMensaje(null);
    try {
      await api(`/usuarios/${u.id}`, { metodo: 'PUT', datos: { activo: !u.activo, justificacion: u.activo ? 'Desactivado desde administración' : 'Reactivado desde administración' } });
      cargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Usuarios y permisos</h1>
          <p className="bajada">
            Cada rol ve solo lo que necesita: la jefatura, su instituto; el profesional, su propia planificación.
            Las altas y bajas quedan en el registro de auditoría.
          </p>
        </div>
      </header>

      {mensaje && <div className={mensaje.tipo === 'ok' ? 'mensaje-ok' : 'mensaje-error'} role="status" style={{ marginBottom: 16 }}>{mensaje.texto}</div>}

      <div className="editor">
        <section className="panel" aria-labelledby="t-lista">
          <h2 id="t-lista" style={{ marginBottom: 10 }}>Usuarios</h2>
          {!usuarios ? <p className="cargando">Cargando…</p> : (
            <div className="tabla-envoltura">
              <table>
                <thead><tr><th>Usuario</th><th>Rol</th><th>Ve</th><th>Estado</th><th><span className="oculto-visual">Acción</span></th></tr></thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nombre}<div style={{ fontSize: '.82rem', color: 'var(--texto-3)' }}>{u.email}</div></td>
                      <td>{NOMBRE_ROL[u.rol]}</td>
                      <td>
                        {u.rol === 'JEFATURA' && `Instituto ${nombreIT(u.it)}`}
                        {u.rol === 'PROFESIONAL' && `PersonaId ${u.personaId}`}
                        {(u.rol === 'PLANIFICADOR' || u.rol === 'DMN') && 'Todo el país'}
                        {u.rol === 'ADMIN' && 'Usuarios y auditoría'}
                      </td>
                      <td>{u.activo ? <span className="chip ok">Activo</span> : <span className="chip">Desactivado</span>}</td>
                      <td><button type="button" className="boton secundario chico" onClick={() => alternarActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel editor-panel" aria-labelledby="t-nuevo">
          <h2 id="t-nuevo">Crear usuario</h2>
          <form onSubmit={crear} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <div className="campo"><label htmlFor="u-email">Correo</label>
              <input id="u-email" type="email" required value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></div>
            <div className="campo"><label htmlFor="u-nombre">Nombre visible</label>
              <input id="u-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></div>
            <div className="campo"><label htmlFor="u-rol">Rol</label>
              <select id="u-rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                {Object.entries(NOMBRE_ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            {nuevo.rol === 'JEFATURA' && (
              <div className="campo"><label htmlFor="u-it">Instituto</label>
                <select id="u-it" required value={nuevo.it} onChange={(e) => setNuevo({ ...nuevo, it: e.target.value })}>
                  <option value="">Elige un instituto</option>
                  {institutos.map((i) => <option key={i.it} value={i.it}>{i.nombre}</option>)}
                </select></div>
            )}
            {nuevo.rol === 'PROFESIONAL' && (
              <div className="campo"><label htmlFor="u-pid">PersonaId</label>
                <input id="u-pid" type="number" required value={nuevo.personaId} onChange={(e) => setNuevo({ ...nuevo, personaId: e.target.value })} /></div>
            )}
            <div className="campo"><label htmlFor="u-pass">Contraseña inicial</label>
              <input id="u-pass" type="password" required minLength={8} value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />
              <span className="ayuda">Mínimo 8 caracteres.</span></div>
            <button className="boton" type="submit">Crear usuario</button>
          </form>
        </section>
      </div>
    </>
  );
}
