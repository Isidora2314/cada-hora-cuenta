# Contrato entre Blue Prism y el backend

Este documento explica qué debe enviar el robot de Blue Prism y qué responde el sistema.

## 1. Conexión

| Dato | Valor |
|---|---|
| URL base | `http://localhost:4000` en la misma máquina, o la URL pública del Codespace (ver sección 6) |
| Método | `POST` (y `GET` para ping y estado) |
| Header 1 | `Content-Type: application/json` |
| Header 2 | `x-api-key: <BOT_API_KEY del archivo backend/.env>` |

Primero prueba la conexión con `GET /api/bot/ping`. Debe responder `{"mensaje":"Conexión con Blue Prism OK"}`.

## 2. Reporte BUK: `POST /api/bot/buk`

El robot lee el Excel de BUK (hoja `Dotacion_2026`, con los encabezados en la **fila 2**) y envía cada fila como un objeto.
**Se pueden usar los mismos nombres de columna del Excel**: el backend los reconoce aunque tengan tildes o espacios.

```json
{
  "archivo": "BUK_Agosto_2026.xlsx",
  "registros": [
    {
      "IT": 11,
      "Instituto": "Ari",
      "PersonaId": 71580,
      "Área": "Arica",
      "Nombre Sub-área": "Kinesiología",
      "Centro de Costo": "300501",
      "Fecha de Nacimiento": "1967-11-09",
      "Periodo": "2026-08-01",
      "Tipo de Contrato": "Indefinido",
      "Fecha Ingreso Compañía": "2008-04-01",
      "Fecha Término": "",
      "Horas Semanales": 42,
      "Cargo": "KINESIOLOGO",
      "Tipo_Trabajador": "Titular",
      "Días de la Jornada": "lmwjv",
      "Reg_SIC": "D - SIC",
      "Cod_Esp": "KI",
      "Ndias": 5
    }
  ]
}
```

- **Obligatorias:** `IT`, `PersonaId`, `Periodo`, `Horas Semanales`, `Cargo` y `Cod_Esp`.
- **Fechas aceptadas:** `2026-08-01`, `01-08-2026`, `01/08/2026`, `01/08/2026 0:00:00` o el número de serie de Excel.
- **Protección de datos:** de la fecha de nacimiento solo se guarda el mes. Si prefieren, el robot puede enviar `"mesNacimiento": 11` en vez de la fecha.
- **Contenido del reporte:** envíen el reporte completo, con todos los meses. El sistema compara y se queda solo con lo que cambió.

**Respuesta**
```json
{
  "cargaId": 3,
  "resumen": { "recibidos": 3571, "cargados": 3565, "conError": 5, "filasVacias": 1, "actualizadosSinRevision": 3539 },
  "cambiosDetectados": 6,
  "cambiosPorTipo": { "ALTA": 1, "NUEVO_REEMPLAZO": 1, "BAJA": 1, "CAMBIO_JORNADA": 1, "CAMBIO_CARGO": 1, "CAMBIO_VIGENCIA": 1 },
  "errores": [ { "fila": 3569, "columna": "Horas Semanales", "tipo": "HORAS_FUERA_RANGO", "valor": 60, "mensaje": "Las horas semanales deben estar entre 1 y 45", "personaId": 71697 } ],
  "totalErrores": 6
}
```
- `fila` es la posición dentro de la lista `registros` (1 = el primer registro). En el Excel de BUK, la fila real es `fila + 2`.
- Las filas con error **no se cargan**. El resto sí.
- Los **cambios** quedan "por revisar" en la pantalla *Cambios de BUK*, donde Planificación los aplica.

**Errores que detecta el backend:** `COLUMNA_FALTANTE`, `ENCABEZADO_REPETIDO`, `DATO_FALTANTE`, `FECHA_INVALIDA`, `HORAS_FUERA_RANGO` (horas ≤ 0 o > 45), `COD_ESP_DESCONOCIDO`, `CARGO_SIN_PARAMETRO` y `PERSONA_DUPLICADA` (mismo PersonaId, IT y período).

**Cambios que detecta:**

| Tipo | Cuándo |
|---|---|
| `ALTA` | PersonaId + IT nuevo (titular) |
| `NUEVO_REEMPLAZO` | PersonaId + IT nuevo con `Tipo_Trabajador = Reemplazo` |
| `BAJA` | Estaba el mes anterior y ya no aparece en el último mes del reporte |
| `CAMBIO_JORNADA` | Cambian las horas semanales (rige desde ese mes) |
| `CAMBIO_CARGO` | Cambia el cargo (rige desde ese mes) |
| `CAMBIO_VIGENCIA` | Cambia la fecha de término del contrato |

## 3. Reporte SIC: `POST /api/bot/sic`

```json
{
  "archivo": "SIC_Julio_2026.xlsx",
  "registros": [
    { "PersonaId": 71580, "IT": 11, "Periodo": "2026-07-01", "Cod_Esp": "KI", "Atenciones Directas": 140, "Atenciones Indirectas": 22 }
  ]
}
```
Si vuelven a cargar un mes, este **reemplaza** lo que había de ese mismo mes. Con estos datos se calcula el cumplimiento y aparecen las alertas de desviación en el dashboard.

## 4. Errores que encuentre el robot: `POST /api/bot/errores`

Si Blue Prism detecta problemas al abrir o leer el archivo (archivo dañado, hoja que no existe, etc.):
```json
{ "archivo": "BUK_Agosto_2026.xlsx", "errores": [ { "fila": 0, "columna": "", "tipo": "HOJA_NO_ENCONTRADA", "valor": "Dotacion_2026", "mensaje": "El archivo no tiene la hoja Dotacion_2026" } ] }
```

## 5. Estado: `GET /api/bot/estado`

Devuelve la última carga de BUK y de SIC, y cuántos cambios hay por revisar.

## 6. Pasos sugeridos en Blue Prism

> **Atajo:** la carpeta `blueprism/` del repo trae estos pasos ya armados (objeto *Teleton API* y proceso *Carga BUK Teleton*). Los pasos 4 y 5 los hace el objeto con code stages, sin *Utility - JSON* ni *Utility - HTTP*.

1. **Esperar el archivo:** revisar la carpeta de entrada (por ejemplo `C:\Botathon\entrada`) hasta que aparezca un `.xlsx`.
2. **Leer el Excel:** usar el objeto *MS Excel VBO*, acción **Get Worksheet As Collection** sobre la hoja `Dotacion_2026`.
   - El archivo trae la **fila 1 vacía** y los encabezados en la **fila 2**. Lean el rango desde `A2` (con *Get Worksheet Range As Collection*) o borren la primera fila de la colección.
3. **Validaciones del robot:** que exista la hoja, que existan las columnas obligatorias y que el archivo no esté vacío. Si algo falla, llamar a `POST /api/bot/errores` y mover el archivo a `C:\Botathon\error`.
4. **Convertir a JSON:** con *Utility - JSON*, acción **Collection to JSON**. Hay dos formas de enviarlo:
   - **Simple:** enviar directamente el JSON de la colección (una lista `[ {...}, {...} ]`). El backend también lo acepta.
   - **Completa:** armar el texto `{"archivo": "<nombre>", "registros": <JSON de la colección>}` con una etapa de cálculo, para que el nombre del archivo quede en el historial.
5. **Enviar:** con *Utility - HTTP*, acción **HTTP Request**, método `POST`, a la URL `/api/bot/buk`, con los headers `Content-Type` y `x-api-key`.
6. **Leer la respuesta:** con *JSON to Collection*, tomar `cambiosDetectados` y `totalErrores`, y escribir en el log del proceso.
7. **Archivar:** mover el archivo a `C:\Botathon\procesados` con la fecha en el nombre.
8. **(Deseable)** Enviar un correo a Planificación: "Se detectaron N cambios y M errores en el reporte de BUK".

Para SIC es el mismo proceso, enviando a `/api/bot/sic`.

**Si el backend corre en GitHub Codespaces:** en la pestaña PORTS, hagan clic derecho en el puerto 4000, elijan *Port Visibility → Public* y usen esa URL (`https://...-4000.app.github.dev`). Si el puerto queda privado, Blue Prism recibe un error de inicio de sesión de GitHub. Si Blue Prism está en la máquina virtual, también pueden correr el backend ahí mismo y usar `http://localhost:4000`.

## 7. Probar sin Blue Prism

`backend/scripts/enviarReporte.js` hace exactamente lo mismo que el robot (lee el Excel y lo envía):
```bash
cd backend
npm run demo          # crea los Excel de demo en excel/demo
node scripts/enviarReporte.js buk excel/demo/BUK_Agosto_2026_demo.xlsx
node scripts/enviarReporte.js sic excel/demo/SIC_Ene_Jul_2026_demo.xlsx
```
Si el backend está en otra dirección, agréguenla al final: `... BUK_Agosto_2026_demo.xlsx https://xxxx-4000.app.github.dev`.
