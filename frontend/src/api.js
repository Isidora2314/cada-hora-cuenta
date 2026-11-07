// ------------------------------------------------------------
// Conexión con el backend. Todas las llamadas pasan por aquí.
// ------------------------------------------------------------

const CLAVE_TOKEN = 'chc_token';

export function leerToken() {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
}
export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch { /* el navegador no permite guardar: la sesión dura hasta recargar */ }
}

// Llamada genérica: agrega el token y convierte la respuesta a JSON
export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const token = leerToken();
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const json = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(json.error || 'No se pudo conectar con el servidor');
    error.status = respuesta.status;
    throw error;
  }
  return json;
}

// Ayudas para mostrar números en formato chileno
const formato = new Intl.NumberFormat('es-CL');
export const n = (x) => (x === null || x === undefined ? '–' : formato.format(Math.round(x)));
export const pct = (x, dec = 1) => (x === null || x === undefined ? '–' : `${(x * 100).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`);

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Nombres de las especialidades (Cod_Esp)
export const ESPECIALIDADES = {
  KI: 'Kinesiología', TO: 'Terapia ocupacional', FI: 'Fisiatría', AS: 'Servicio social',
  PC: 'Psicología', FO: 'Fonoaudiología', EN: 'Enfermería', ED: 'Educación',
  ULAB: 'Unidad laboral', UTAC: 'Terapias artísticas', UEDA: 'Deporte adaptado',
  UTA: 'Tecnología asistiva', NU: 'Nutrición', HO: 'Hospitalizados', MG: 'Medicina general',
  NE: 'Neurología', OR: 'Ortopedia', PE: 'Pediatría', TR: 'Telerehabilitación',
};
export const nombreEsp = (c) => ESPECIALIDADES[c] || c;

export const NOMBRE_ROL = {
  ADMIN: 'Administración TI',
  PLANIFICADOR: 'Planificación central',
  DMN: 'Dirección Médica Nacional',
  JEFATURA: 'Jefatura de instituto',
  PROFESIONAL: 'Profesional',
};

// Cargo en formato legible: "KINESIOLOGO" -> "Kinesiologo"
export const cargoBonito = (c) => (c ? c.charAt(0) + c.slice(1).toLowerCase() : '');
