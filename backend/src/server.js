// ------------------------------------------------------------
// Punto de entrada: conecta los datos (archivos o Supabase)
// y levanta el servidor en el puerto del .env (Render pone PORT solo).
// ------------------------------------------------------------
const app = require('./app');
const repo = require('./repositorio/archivoJson');

if (!process.env.JWT_SECRET || !process.env.BOT_API_KEY) {
  console.error('Faltan JWT_SECRET y BOT_API_KEY (en local: copia .env.example como .env; en Render: pestaña Environment)');
  process.exit(1);
}

const PUERTO = process.env.PORT || 4000;

repo.iniciar()
  .then(() => {
    app.listen(PUERTO, () => {
      console.log(`Backend escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((e) => {
    console.error('No se pudo conectar con la base de datos:', e.message);
    process.exit(1);
  });
