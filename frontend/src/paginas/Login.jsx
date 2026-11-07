// ------------------------------------------------------------
// Inicio de sesión. Incluye accesos rápidos a los usuarios de
// prueba para la demo (se completan con un clic).
// ------------------------------------------------------------
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../sesion';
import { inicioDe } from '../App';
import Logo from '../componentes/Logo';

const DEMO = [
  { email: 'planificador@teleton.cl', texto: 'Planificación central' },
  { email: 'dmn@teleton.cl', texto: 'Dirección Médica' },
  { email: 'jefatura.ari@teleton.cl', texto: 'Jefatura Arica' },
  { email: 'profesional.71580@teleton.cl', texto: 'Profesional' },
  { email: 'admin@teleton.cl', texto: 'Administración TI' },
];

export default function Login() {
  const { entrar } = useSesion();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await entrar(email, password);
      navegar(inicioDe(r.usuario), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-lado" aria-label="Presentación">
        <div style={{ position: 'relative' }}>
          <div className="login-logo">
            <Logo />
            <span className="login-logo-desc">Planificación asistencial de los Institutos</span>
          </div>
          <h1>Cada hora cuenta</h1>
          <p>
            La planificación asistencial de todos los institutos en un solo lugar: horas de cada
            profesional, metas de atención y cambios de dotación al día, sin copiar y pegar.
          </p>
        </div>
        <div className="login-datos">
          <div><b>15</b>institutos</div>
          <div><b>464</b>profesionales</div>
          <div><b>12</b>meses planificados</div>
        </div>
        <div className="reloj" aria-hidden="true" />
      </section>

      <section className="login-form">
        <form onSubmit={enviar} noValidate>
          <div>
            <h2 style={{ fontSize: '1.5rem' }}>Iniciar sesión</h2>
            <p style={{ color: 'var(--texto-2)', marginTop: 6 }}>Usa tu correo institucional.</p>
          </div>
          {error && <div className="mensaje-error" role="alert">{error}</div>}
          <div className="campo">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="boton" type="submit" disabled={enviando || !email || !password}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="accesos">
            <p>Usuarios de prueba (contraseña Demo2026!):</p>
            <div className="accesos-lista">
              {DEMO.map((d) => (
                <button key={d.email} type="button" className="boton secundario chico"
                  onClick={() => { setEmail(d.email); setPassword('Demo2026!'); }}>
                  {d.texto}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
