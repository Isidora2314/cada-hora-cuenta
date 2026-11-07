// Configuración de Vite.
// En desarrollo, las llamadas a /api se envían al backend (puerto 4000).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // necesario para GitHub Codespaces
    proxy: { '/api': 'http://localhost:4000' },
  },
});
