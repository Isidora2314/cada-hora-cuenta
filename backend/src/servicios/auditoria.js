// ------------------------------------------------------------
// Registro de auditoría: guarda QUIÉN cambió QUÉ, CUÁNDO y POR QUÉ.
// Se llama desde cualquier ruta que modifique datos.
// ------------------------------------------------------------
const repo = require('../repositorio/archivoJson');

function registrar({ usuario, accion, entidad, idEntidad, valorAnterior, valorNuevo, justificacion }) {
  const log = repo.leer('auditoria');
  log.push({
    id: log.length + 1,
    fechaHora: new Date().toISOString(),
    usuario: usuario ? usuario.email : 'sistema',
    rol: usuario ? usuario.rol : 'SISTEMA',
    accion,            // ej: 'CREAR', 'EDITAR', 'DESACTIVAR', 'LOGIN'
    entidad,           // ej: 'usuario', 'parametro'
    idEntidad: idEntidad ?? null,
    valorAnterior: valorAnterior ?? null,
    valorNuevo: valorNuevo ?? null,
    justificacion: justificacion || null,
  });
  repo.guardar('auditoria', log);
}

module.exports = { registrar };
