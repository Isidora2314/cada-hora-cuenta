// ------------------------------------------------------------
// Administración de usuarios (SOLO rol ADMIN)
//   GET  /api/usuarios       -> lista de usuarios (sin contraseñas)
//   POST /api/usuarios       -> crear usuario
//   PUT  /api/usuarios/:id   -> editar rol, instituto, PersonaId, activo o contraseña
// ------------------------------------------------------------
const express = require('express');
const bcrypt = require('bcryptjs');
const repo = require('../repositorio/archivoJson');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../permisos');
const auditoria = require('../servicios/auditoria');

const router = express.Router();
router.use(autenticar, permitirRoles(ROLES.ADMIN));

// Quita la contraseña antes de enviar un usuario al frontend
function sinPassword(u) {
  const { passwordHash, ...resto } = u;
  return resto;
}

// Revisa que los datos del usuario tengan sentido según su rol
function validar(datos) {
  if (!Object.values(ROLES).includes(datos.rol)) return 'Rol no válido';
  if (datos.rol === ROLES.JEFATURA && !datos.it) return 'La jefatura debe tener un instituto (IT)';
  if (datos.rol === ROLES.PROFESIONAL && !datos.personaId) return 'El profesional debe tener un PersonaId';
  return null;
}

router.get('/', (req, res) => {
  res.json(repo.leer('usuarios').map(sinPassword));
});

router.post('/', (req, res) => {
  const { email, nombre, rol, it, personaId, password, justificacion } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });

  const usuarios = repo.leer('usuarios');
  if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }

  const nuevo = {
    id: usuarios.length ? Math.max(...usuarios.map((u) => u.id)) + 1 : 1,
    email,
    nombre: nombre || email,
    rol,
    it: it ? Number(it) : null,
    personaId: personaId ? Number(personaId) : null,
    activo: true,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  const error = validar(nuevo);
  if (error) return res.status(400).json({ error });

  usuarios.push(nuevo);
  repo.guardar('usuarios', usuarios);
  auditoria.registrar({
    usuario: req.usuario, accion: 'CREAR', entidad: 'usuario', idEntidad: nuevo.id,
    valorNuevo: sinPassword(nuevo), justificacion,
  });
  res.status(201).json(sinPassword(nuevo));
});

router.put('/:id', (req, res) => {
  const usuarios = repo.leer('usuarios');
  const usuario = usuarios.find((u) => u.id === Number(req.params.id));
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const anterior = sinPassword(usuario);
  const { nombre, rol, it, personaId, activo, password, justificacion } = req.body || {};

  if (nombre !== undefined) usuario.nombre = nombre;
  if (rol !== undefined) usuario.rol = rol;
  if (it !== undefined) usuario.it = it ? Number(it) : null;
  if (personaId !== undefined) usuario.personaId = personaId ? Number(personaId) : null;
  if (activo !== undefined) usuario.activo = Boolean(activo);
  if (password) usuario.passwordHash = bcrypt.hashSync(password, 10);

  const error = validar(usuario);
  if (error) return res.status(400).json({ error });

  repo.guardar('usuarios', usuarios);
  auditoria.registrar({
    usuario: req.usuario,
    accion: activo === false ? 'DESACTIVAR' : 'EDITAR',
    entidad: 'usuario', idEntidad: usuario.id,
    valorAnterior: anterior, valorNuevo: sinPassword(usuario), justificacion,
  });
  res.json(sinPassword(usuario));
});

module.exports = router;
