// ------------------------------------------------------------
// Crea los usuarios de prueba (uno por rol).
// Uso:  npm run usuarios
// Contraseña de todos: Demo2026!
// ------------------------------------------------------------
const bcrypt = require('bcryptjs');
const repo = require('../src/repositorio/archivoJson');

const CLAVE = 'Demo2026!';
const hash = bcrypt.hashSync(CLAVE, 10);

const usuarios = [
  { id: 1, email: 'admin@teleton.cl', nombre: 'Administración TI', rol: 'ADMIN', it: null, personaId: null },
  { id: 2, email: 'planificador@teleton.cl', nombre: 'Planificación Central', rol: 'PLANIFICADOR', it: null, personaId: null },
  { id: 3, email: 'dmn@teleton.cl', nombre: 'Dirección Médica Nacional', rol: 'DMN', it: null, personaId: null },
  { id: 4, email: 'jefatura.ari@teleton.cl', nombre: 'Jefatura Arica', rol: 'JEFATURA', it: 11, personaId: null },
  { id: 5, email: 'profesional.71580@teleton.cl', nombre: 'Profesional 71580', rol: 'PROFESIONAL', it: 11, personaId: 71580 },
].map((u) => ({ ...u, activo: true, passwordHash: hash }));

repo.guardar('usuarios', usuarios);
console.log(`Usuarios de prueba creados (contraseña: ${CLAVE}):`);
console.table(usuarios.map(({ email, rol, it, personaId }) => ({ email, rol, it, personaId })));
