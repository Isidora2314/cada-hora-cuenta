# Blue Prism — archivos para importar

Esta carpeta tiene lo necesario para que el robot lea el reporte BUK, lo valide y lo envíe al backend.

| Archivo | Qué es |
|---|---|
| `BPA Object - Teleton API.xml` | **Objeto** con 3 acciones: `Ping`, `Enviar Reporte` y `Enviar Errores`. Convierte una colección a JSON y la envía por HTTP. No necesita *Utility - JSON* ni *Utility - HTTP*. |
| `BPA Process - Carga BUK Teleton.xml` | **Proceso** completo: lee el BUK, valida cada fila, guarda `Errores_BUK.xlsx` y envía todo al backend. |
| `codigo-vb/` | El mismo código del objeto en archivos `.vb`, para armarlo a mano si la importación falla (Plan B). |
| `generador/` | Script en Python que genera los XML (`python generar.py`). |

## Qué hace el proceso

```
Abrir BUK → Leer hoja Dotacion_2026 (desde A2)
   ↓
Recorrer filas: salta las vacías y valida 7 reglas
   (PersonaId vacío, encabezado repetido, horas vacías, horas ≤0 o >45,
    instituto vacío, cargo vacío, Cod_Esp vacío)
   ↓
Guardar Errores_BUK.xlsx en Botathon_Salida  ("Sin errores en el reporte" si no hay)
   ↓
Enviar al backend (POST /api/bot/buk) → el backend detecta altas, bajas,
   cambios de jornada/cargo/vigencia y recalcula la planificación
   ↓
Informar los errores del bot (POST /api/bot/errores)
   ↓
Resumen Carga: "Filas leídas … | vacías … | errores bot … | cambios detectados … | rechazadas backend …"
```

## Paso a paso

### 1. Importar (primero el objeto, después el proceso)
1. En Blue Prism: **File → Import → Process / Object**.
2. Elige `BPA Object - Teleton API.xml` → Next hasta Finish.
3. Repite con `BPA Process - Carga BUK Teleton.xml`.

El proceso usa también **MS Excel VBO** y el objeto interno **Collections**.

### 2. Configurar (doble clic en cada Data Item del proceso)

| Data Item | Qué poner |
|---|---|
| `Ruta Archivo` | Ruta completa del Excel de BUK |
| `Nombre Archivo` | Solo el nombre del archivo (queda en el historial del backend) |
| `Ultima Celda` | `S6000` (las filas vacías se saltan solas) |
| `Carpeta Salida` | Carpeta donde se guarda `Errores_BUK.xlsx` |
| `Hoja Salida` | `Hoja1` si Excel está en español, `Sheet1` si está en inglés |
| `URL Base` | La dirección de Render, por ejemplo `https://cada-hora-cuenta.onrender.com` (sin `/` al final). Ver `docs/despliegue.md` |
| `API Key` | El valor de `BOT_API_KEY` (Render → Environment) |

### 3. Probar la conexión primero
Abre el objeto **Teleton API** en Object Studio → página **Ping** → doble clic en *Start* y pon la `URL Base` y la `API Key` como valores iniciales → ▶. `Exito` debe quedar en `True` y `Respuesta` en `{"mensaje":"Conexión con Blue Prism OK"}`.

### 4. Correr el proceso
- Para probar en Process Studio, usa la velocidad máxima (flecha junto a ▶).
- Para la demo, publícalo (*Properties → Publish to Control Room*) y córrelo desde **Control**: es mucho más rápido.
- Al terminar, mira el Data Item **Resumen Carga**.

## Resultados esperados (probados contra el backend)

| Archivo | Lo que responde el backend |
|---|---|
| `Nac - Base contratos x mes.xlsx` | 4.001 filas recibidas, **3.123 cargadas**, 878 vacías, 0 errores, 0 cambios (son los mismos datos) |
| `backend/excel/demo/BUK_Agosto_2026_demo.xlsx` | 3.565 cargadas, **6 cambios** (alta, baja, reemplazo, jornada, cargo, vigencia) y **6 errores** (encabezado repetido, persona duplicada, 60 horas, fecha 31-02, Cod_Esp y cargo inexistentes) |

El BUK de demo es el ideal para la presentación: el bot marca el encabezado repetido y las 60 horas, y el backend encuentra el resto y los cambios, que aparecen en la pantalla **Cambios de BUK**.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| Un input "no existe" o "Invalid expression for input" en una acción de **MS Excel VBO** | Tu versión del VBO nombra distinto ese input. Abre la acción, vuelve a elegir la acción en la lista y llena los valores de nuevo (los valores correctos están en la tabla de abajo). |
| `Worksheet Not Found` al escribir errores | Cambia `Hoja Salida` a `Sheet1`. |
| `Sin conexión con el backend` | Revisa la `URL Base`. En Render gratis, la primera llamada puede tardar ~50 s mientras despierta. |
| `Codigo HTTP` = 401 | La `API Key` no coincide con `BOT_API_KEY` de Render. |
| Error al importar el objeto | Usa el Plan B. |

Valores de las acciones de Excel (por si hay que volver a llenarlas):

| Acción | Inputs | Output |
|---|---|---|
| Create Instance | — | handle → `Handle` |
| Open Workbook | handle `[Handle]`, File name `[Ruta Archivo]` | Workbook name → `Libro` |
| Get Worksheet Range As Collection | handle `[Handle]`, Workbook Name `[Libro]`, Worksheet Name `"Dotacion_2026"`, Use Clipboard `False`, StartCell `"A2"`, EndCell `[Ultima Celda]`, Use Header `True` | Data → `Dotacion` |
| Create Workbook | handle `[Handle]` | Workbook Name → `Libro Salida` |
| Write Collection | handle, Workbook Name `[Libro Salida]`, Collection `[Errores]`, Worksheet Name `[Hoja Salida]`, Cell Reference `"A1"`, Include Column Names `True` | — |
| Save Workbook As | handle, Workbook Name `[Libro Salida]`, Filename `[Carpeta Salida] & "\Errores_BUK.xlsx"` | — |
| Close Workbook (errores) | handle, Workbook Name `"Errores_BUK.xlsx"`, Save Changes `False` | — |
| Close Workbook (BUK) | handle, Workbook Name `[Libro]`, Save Changes `False` | — |

## Plan B: armar el objeto a mano
1. **Studio → Objects → clic derecho → Create Object** → nombre `Teleton API`.
2. En la página **Initialise**, doble clic en el cuadro de información del objeto → pestaña **Code Options**:
   - Language: **Visual Basic**
   - Referencias: `System.dll`, `System.Data.dll`, `System.Xml.dll`
   - Namespaces: `System`, `System.Data`, `System.Net`, `System.Text`
   - Pestaña **Global Code**: pega `codigo-vb/0-Global code (Initialise).vb`
3. Crea una página (acción) **Enviar Reporte** con un **Code stage**:
   - Inputs: `URLBase` (Text), `APIKey` (Text), `Tipo` (Text), `Archivo` (Text), `Registros` (Collection)
   - Outputs: `Exito` (Flag), `CodigoHTTP` (Number), `Respuesta` (Text), `CambiosDetectados` (Number), `TotalErrores` (Number), `RegistrosEnviados` (Number)
   - Pestaña Code: pega `codigo-vb/2-Enviar Reporte.vb`
4. Lo mismo para **Ping** (`1-Ping.vb`: inputs URLBase, APIKey; outputs Exito, CodigoHTTP, Respuesta) y **Enviar Errores** (`3-Enviar Errores.vb`: inputs URLBase, APIKey, Archivo, Errores; outputs Exito, CodigoHTTP, Respuesta, ErroresEnviados).
5. Conecta Start → Code stage → End en cada página, con los inputs en Start y los outputs en End.

## Nota sobre el código
El objeto se escribió sin una instalación de Blue Prism para compilarlo. La lógica (JSON y llamadas HTTP) se probó contra el backend real con el mismo formato de datos, pero si Blue Prism marca un error de compilación en un code stage, el mensaje indica la línea a corregir.
