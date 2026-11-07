// ------------------------------------------------------------
// Logo de Teletón.
// Pon el archivo OFICIAL del logo (entregado por la organización) en:
//   frontend/public/logo-teleton.png   (para futuras compilaciones)
//   frontend/dist/logo-teleton.png     (para verlo ya, sin compilar)
// Si el archivo no está, se muestra el nombre "Teletón" en rojo.
// ------------------------------------------------------------
import { useState } from 'react';

export default function Logo() {
  const [sinArchivo, setSinArchivo] = useState(false);
  if (sinArchivo) return <span className="logo-texto">Teletón</span>;
  return (
    <img
      className="logo-teleton"
      src="/logo-teleton.png"
      alt="Teletón"
      onError={() => setSinArchivo(true)}
    />
  );
}
