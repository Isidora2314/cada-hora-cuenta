// ------------------------------------------------------------
// Protege las rutas /api/bot/* que usa Blue Prism.
// El bot debe enviar el header:  x-api-key: <BOT_API_KEY del .env>
// ------------------------------------------------------------
function validarApiKeyBot(req, res, next) {
  const clave = req.headers['x-api-key'];
  if (!clave || clave !== process.env.BOT_API_KEY) {
    return res.status(401).json({ error: 'API key del bot inválida' });
  }
  // Así la auditoría registra que el cambio lo hizo el bot
  req.usuario = { email: 'bot@blueprism', rol: 'BOT' };
  next();
}

module.exports = { validarApiKeyBot };
