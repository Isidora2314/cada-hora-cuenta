// ------------------------------------------------------------
// Sesión del usuario: guarda quién está conectado y su menú.
// ------------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react';
import { api, guardarToken, leerToken } from './api';

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null);   // { usuario, menu, alcance }
  const [cargando, setCargando] = useState(true);

  // Al abrir la app, si hay token guardado, recupera la sesión
  useEffect(() => {
    if (!leerToken()) { setCargando(false); return; }
    api('/auth/yo')
      .then(setSesion)
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false));
  }, []);

  async function entrar(email, password) {
    const r = await api('/auth/login', { metodo: 'POST', datos: { email, password } });
    guardarToken(r.token);
    setSesion({ usuario: r.usuario, menu: r.menu, alcance: r.alcance });
    return r;
  }

  function salir() {
    guardarToken(null);
    setSesion(null);
  }

  return (
    <ContextoSesion.Provider value={{ sesion, cargando, entrar, salir }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export const useSesion = () => useContext(ContextoSesion);
