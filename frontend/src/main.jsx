import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProveedorSesion } from './sesion';
import './styles.css';

// Recupera la preferencia de "lectura fácil" del navegador
try {
  if (localStorage.getItem('chc_lectura_facil') === '1') document.documentElement.classList.add('lectura-facil');
} catch { /* sin almacenamiento: se usa el tamaño normal */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </React.StrictMode>,
);
