// ------------------------------------------------------------
// Rutas de autenticación
//   POST /api/auth/login  -> recibe email y password, devuelve token
//   GET  /api/auth/yo     -> datos del usuario conectado y su menú
// ------------------------------------------------------------
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../repositorio/archivoJson');
const { autenticar } = require('../middleware/auth');
const { MENU, ALCANCE } = require('../permisos');
const auditoria = require('../servicios/auditoria');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Ingresa tu correo y contraseña' });
  }

  const usuarios = repo.leer('usuarios');
  const usuario = usuarios.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

  // Mismo mensaje si no existe o si la clave es incorrecta (no damos pistas)
  if (!usuario || !bcrypt.compareSync(password, usuario.passwordHash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  if (!usuario.activo) {
    return res.status(403).json({ error: 'Tu usuario está desactivado' });
  }

  // Datos que viajan dentro del token (sin la contraseña)
  const datos = {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    it: usuario.it ?? null,
    personaId: usuario.personaId ?? null,
  };
  const token = jwt.sign(datos, process.env.JWT_SECRET, { expiresIn: '8h' });

  auditoria.registrar({ usuario: datos, accion: 'LOGIN', entidad: 'sesion', idEntidad: usuario.id });

  res.json({ token, usuario: datos, menu: MENU[usuario.rol], alcance: ALCANCE[usuario.rol] });
});

router.get('/yo', autenticar, (req, res) => {
  res.json({ usuario: req.usuario, menu: MENU[req.usuario.rol], alcance: ALCANCE[req.usuario.rol] });
});

module.exports = router;
