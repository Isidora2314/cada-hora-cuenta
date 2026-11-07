# Despliegue: Supabase + Render + Blue Prism

```
Blue Prism (VM) ──HTTPS──▶ Render (backend Node.js + página React) ──▶ Supabase (PostgreSQL)
```

- El **frontend React** ya viene compilado en `frontend/dist` y lo sirve el mismo backend: hay **un solo servicio** en Render.
- Si el backend no tiene `DATABASE_URL`, guarda en los JSON de `backend/data` (modo local).

---

## 1. Supabase (la base de datos)

1. Entra a https://supabase.com → **New project**.
   - Name: `cada-hora-cuenta`
   - **Database Password**: apriétale *Generate a password* y **guárdala** (la necesitas en el paso 4).
   - Region: **South America (São Paulo)**.
2. Cuando el proyecto esté listo, apreta **Connect** (arriba).
3. Elige **Session pooler** y copia la **URI**. Se ve así:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
4. Reemplaza `[YOUR-PASSWORD]` por la clave del paso 1 (sin corchetes). Esa es tu **DATABASE_URL**.

Usa **Session pooler** y no "Direct connection": la conexión directa de Supabase solo funciona por IPv6, y Render no la soporta.

No hay que crear tablas: el backend crea la tabla `tablas` y la llena con los datos del repo la primera vez que arranca. También le activa *Row Level Security*, para que la API pública de Supabase no pueda leer los datos.

---

## 2. Render (backend + página)

1. Entra a https://render.com con tu cuenta de GitHub.
2. **New → Blueprint** → elige el repo **cada-hora-cuenta** → **Connect**.
3. Render lee `render.yaml` y te pide **DATABASE_URL**: pega la del paso 1. → **Apply**.
4. Espera el deploy (unos 3 minutos). En el log debe aparecer:
   `Datos: Supabase (18 tablas; 18 copiadas desde los JSON del repo)` y `Backend escuchando…`
5. Tu dirección queda arriba, por ejemplo `https://cada-hora-cuenta.onrender.com`.

### ¿De dónde saco BOT_API_KEY y JWT_SECRET?
**Render las crea solas** (por `generateValue: true` en `render.yaml`). Para verlas:
**Render → tu servicio → Environment** → en `BOT_API_KEY`, apreta el ícono del ojo y copia el valor.

| Variable | Qué es | ¿Quién la usa? |
|---|---|---|
| `BOT_API_KEY` | Clave del robot | **Blue Prism** (Data Item `API Key`) |
| `JWT_SECRET` | Clave interna para firmar las sesiones | Solo el backend. No hace falta copiarla. |
| `DATABASE_URL` | Conexión a Supabase | Solo el backend |

¿Prefieres inventarlas tú? En PowerShell, esto genera una clave al azar de 40 caracteres:
```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```
Pégala en Render → Environment y guarda (Render vuelve a desplegar solo).

**Nunca subas estas claves a GitHub** ni las pegues en un chat. El archivo `.env` está en `.gitignore`.

---

## 3. Probar desde la VM (PowerShell)

Cambia las dos primeras variables por tu dirección de Render y tu `BOT_API_KEY`:
```powershell
$url = "https://cada-hora-cuenta.onrender.com"
$key = "PEGA-AQUI-TU-BOT_API_KEY"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Invoke-RestMethod -Uri "$url/api/salud"                                        # cuántos registros hay
Invoke-RestMethod -Uri "$url/api/bot/ping"   -Headers @{ "x-api-key" = $key }  # "Conexión con Blue Prism OK"
Invoke-RestMethod -Uri "$url/api/bot/estado" -Headers @{ "x-api-key" = $key }  # última carga
```

| Resultado | Significa |
|---|---|
| `Not Found` | La dirección está mal escrita (o quedó `TU-APP`). |
| `API key del bot inválida` / 401 | La clave no coincide con `BOT_API_KEY` de Render. |
| Tarda ~50 s la primera vez | Render gratis "duerme" tras 15 min sin uso. Es normal. |

---

## 4. Blue Prism

En el proceso **Carga BUK Teleton** (carpeta `blueprism/`):
- `URL Base` = tu dirección de Render (sin `/` al final)
- `API Key` = tu `BOT_API_KEY`

El resto está en `blueprism/README.md`.

---

## 5. Dejar los datos limpios antes de la demo

**Opción fácil (sin instalar nada):**
1. Supabase → **SQL Editor** → ejecuta: `truncate tablas;`
2. Render → tu servicio → **Manual Deploy → Restart service**.
Al arrancar, el backend vuelve a copiar los datos originales del repo.

**Opción con Node (en tu PC):**
```powershell
cd backend
copy .env.example .env      # y pega DATABASE_URL en el .env
npm install
npm run subir-datos
```
Después reinicia el servicio en Render.

---

## 6. Antes de presentar
- Abre la página de Render unos minutos antes, para que no esté "dormida".
- Usuarios de prueba: `planificador@teleton.cl`, `dmn@teleton.cl`, `jefatura.ari@teleton.cl`… clave `Demo2026!`.
- Archivo para la demo del bot: `backend/excel/demo/BUK_Agosto_2026_demo.xlsx` (6 cambios y 6 errores).
