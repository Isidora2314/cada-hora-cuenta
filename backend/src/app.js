// ------------------------------------------------------------
// Configuración de la aplicación Express (sin levantar el puerto).
// Se separa de server.js para poder usarla en los tests.
// ------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const repo = require('./repositorio/archivoJson');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // el bot enviará reportes grandes

// Ruta de prueba: cuántos registros hay en cada tabla
app.get('/api/salud', (req, res) => {
  const tablas = [
    'institutos', 'homologacion', 'distribucion', 'asignaciones_catalogo',
    'factor_grupal', 'calendario', 'parametros_generales',
    'excepciones', 'dotacion', 'referencia_excel', 'usuarios',
    'planificacion_base', 'cambios', 'cargas', 'realizado',
  ];
  const resumen = {};
  tablas.forEach((t) => { resumen[t] = repo.leer(t).length; });
  res.json({ estado: 'ok', registros: resumen });
});

// Rutas de la aplicación
app.use('/api/auth', require('./rutas/auth'));
app.use('/api/usuarios', require('./rutas/usuarios'));
app.use('/api/profesionales', require('./rutas/profesionales'));
app.use('/api/parametros', require('./rutas/parametros'));
app.use('/api', require('./rutas/planificacion')); // /api/planificacion y /api/simulaciones
app.use('/api', require('./rutas/dashboard'));     // /api/dashboard y /api/institutos

app.use('/api', require('./rutas/cambios'));       // /api/cambios y /api/cargas
app.use('/api/auditoria', require('./rutas/auditoria'));

// Rutas del bot (Blue Prism): /buk, /sic, /errores, /estado y /ping
app.use('/api/bot', require('./rutas/bot'));

// Página web (frontend compilado con "npm run build" en /frontend).
// Así todo funciona en un solo puerto: http://localhost:4000
const path = require('path');
const fs = require('fs');
const carpetaWeb = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(carpetaWeb)) {
  app.use(express.static(carpetaWeb));
  // Cualquier ruta que no sea /api devuelve la app (React Router se encarga)
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(carpetaWeb, 'index.html')));
}

module.exports = app;
