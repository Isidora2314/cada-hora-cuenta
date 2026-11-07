// ------------------------------------------------------------
// Middlewares de seguridad:
//  - autenticar: revisa que venga un token JWT válido
//  - permitirRoles: deja pasar solo a ciertos roles
//  - filtrarPorAlcance: recorta una lista de datos según el rol
// ------------------------------------------------------------
const jwt = require('jsonwebtoken');
const { ALCANCE } = require('../permisos');

// 1) Revisa el header "Authorization: Bearer <token>"
function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }
  try {
    // Si el token es válido, guardamos los datos del usuario en req.usuario
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

// 2) Uso: permitirRoles('PLANIFICADOR', 'DMN')
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

// 3) Recorta una lista según el alcance del rol.
//    Cada elemento debe tener "it" y "personaId".
function filtrarPorAlcance(usuario, lista) {
  const alcance = ALCANCE[usuario.rol];
  if (alcance === 'NACIONAL') return lista;
  if (alcance === 'INSTITUTO') return lista.filter((x) => x.it === usuario.it);
  if (alcance === 'PROPIO') return lista.filter((x) => x.personaId === usuario.personaId);
  return []; // NINGUNO
}

module.exports = { autenticar, permitirRoles, filtrarPorAlcance };
