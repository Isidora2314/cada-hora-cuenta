// ------------------------------------------------------------
// Punto de entrada: levanta el servidor en el puerto del .env
// ------------------------------------------------------------
const app = require('./app');

if (!process.env.JWT_SECRET || !process.env.BOT_API_KEY) {
  console.error('Falta el archivo .env (copia .env.example como .env)');
  process.exit(1);
}

const PUERTO = process.env.PORT || 4000;
app.listen(PUERTO, () => {
  console.log(`Backend escuchando en http://localhost:${PUERTO}`);
});
