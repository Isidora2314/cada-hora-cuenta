// ------------------------------------------------------------
// Roles del sistema y qué puede hacer cada uno.
// Todo el control de acceso sale de este archivo.
// ------------------------------------------------------------

const ROLES = {
  ADMIN: 'ADMIN',               // Administrador/a TI
  PLANIFICADOR: 'PLANIFICADOR', // Planificador/a central (perfil principal)
  DMN: 'DMN',                   // Dirección Médica Nacional
  JEFATURA: 'JEFATURA',         // Jefatura de instituto
  PROFESIONAL: 'PROFESIONAL',   // Profesional asistencial
};

// Alcance de datos de cada rol:
//  - NACIONAL: ve todos los institutos
//  - INSTITUTO: solo su IT
//  - PROPIO: solo su PersonaId
//  - NINGUNO: no ve planificación
const ALCANCE = {
  ADMIN: 'NINGUNO',
  PLANIFICADOR: 'NACIONAL',
  DMN: 'NACIONAL',
  JEFATURA: 'INSTITUTO',
  PROFESIONAL: 'PROPIO',
};

// Opciones del menú que verá cada rol en el frontend
const MENU = {
  ADMIN: ['usuarios', 'auditoria', 'estado-bot'],
  PLANIFICADOR: ['dashboard', 'profesionales', 'cambios', 'estado-bot', 'parametros', 'simulacion', 'asignaciones', 'versiones', 'auditoria'],
  DMN: ['dashboard', 'profesionales', 'cambios', 'estado-bot', 'asignaciones', 'versiones'],
  JEFATURA: ['dashboard', 'profesionales', 'asignaciones'],
  PROFESIONAL: ['mi-planificacion'],
};

module.exports = { ROLES, ALCANCE, MENU };
