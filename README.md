# Cada hora cuenta — MVP Botathon 2026 (Duoc UC × Teletón)

Sistema de planificación asistencial que reemplaza el Excel actual.
Blue Prism lee y valida los reportes BUK/SIC y envía los datos a este backend.

## Estructura

```
cada-hora-cuenta/
├── backend/
│   ├── excel/                  ← aquí van los 2 Excel del kit
│   ├── data/                   ← JSON generados (hoy hacen de "base de datos")
│   ├── scripts/importar.js     ← lee los Excel y genera los JSON
│   ├── src/
│   │   ├── server.js           ← servidor Express
│   │   └── repositorio/        ← única capa que lee/escribe datos (luego PostgreSQL)
│   ├── .env.example
│   └── package.json
├── frontend/                   ← (etapa 5) React + Vite
├── blueprism/                  ← objeto y proceso de Blue Prism listos para importar
└── docs/                       ← (etapa 4) contrato-bot.md para Blue Prism
```

Los `.zip` de la raíz son las versiones anteriores (etapa 3, v5 y v6); el código vigente es el de las carpetas.

## Despliegue (Render + Supabase)

Paso a paso en **`docs/despliegue.md`**: crear Supabase, desplegar en Render con `render.yaml`, de dónde salen `BOT_API_KEY` y `JWT_SECRET`, pruebas en PowerShell y cómo limpiar los datos antes de la demo.

- Sin `DATABASE_URL`, el backend usa los JSON de `backend/data` (local y tests).
- Con `DATABASE_URL`, usa Supabase: la primera vez copia los JSON del repo y desde ahí todo queda guardado en la base.

## Cómo correrlo con la página web (recomendado)

La carpeta `frontend/dist` ya viene compilada: el backend sirve la página y la API en el mismo puerto.

```bash
cd backend
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run importar
npm run usuarios
npm start
```
Abre http://localhost:4000 (en Codespaces: pestaña PORTS → puerto 4000).

Si cambias algo en `frontend/src`, vuelve a compilar:
```bash
cd frontend
npm install
npm run build
```
Para trabajar en el diseño con recarga automática: `npm run dev` en `frontend` (puerto 5173) con el backend corriendo.

### Pantallas
- **Iniciar sesión**: botones de acceso rápido a los 5 usuarios de prueba.
- **Panorama nacional** (Planificación y DMN): Meta de Gestión, % FOJA, el año mes a mes, meta por instituto y tabla consolidada. Filtros por instituto, especialidad y mes.
- **Instituto**: el mismo panorama para un instituto + lista de profesionales con alertas (la jefatura entra directo aquí).
- **Profesional**: reparto de su semana (directa, indirecta, NAS, asignaciones) y detalle mes a mes.
- **Parámetros**: editar % por cargo, reglas generales y atención grupal; **Simular impacto** antes de guardar; justificación obligatoria.
- **Usuarios** (Administración TI): crear y desactivar usuarios.
- **Lectura fácil** (en el menú): texto más grande y más espacio. Todos los gráficos se pueden ver como tabla y recorrer con teclado.

## Etapa 4: Blue Prism (ingesta de BUK y SIC)

El formato que debe enviar el robot y los pasos en Blue Prism están en **`docs/contrato-bot.md`**.

**Archivos para importar en Blue Prism:** carpeta **`blueprism/`** (objeto *Teleton API* + proceso *Carga BUK Teleton*). El objeto convierte la colección a JSON y la envía por HTTP con code stages, así que no necesita *Utility - JSON* ni *Utility - HTTP*. Instrucciones en `blueprism/README.md`.

```bash
npm run demo        # crea excel/demo/BUK_Agosto_2026_demo.xlsx y SIC_Ene_Jul_2026_demo.xlsx
npm start
# en otra terminal (imita al robot):
node scripts/enviarReporte.js buk excel/demo/BUK_Agosto_2026_demo.xlsx
node scripts/enviarReporte.js sic excel/demo/SIC_Ene_Jul_2026_demo.xlsx
```

- `POST /api/bot/buk`: valida el reporte (errores por fila), actualiza solo lo que no cambió y deja **por revisar** altas, bajas y cambios de jornada, cargo o vigencia, cada uno con su mes de vigencia y su efecto en la meta.
- `POST /api/bot/sic`: carga lo realizado. El dashboard muestra el cumplimiento y las alertas de desviación.
- `POST /api/bot/errores` y `GET /api/bot/estado`.
- Pantallas nuevas: **Cambios de BUK** (aplicar o descartar), **Robot Blue Prism** (cargas y errores) y **Auditoría**.
- Al aplicar un cambio, la fila del profesional se **parte en dos períodos**: los meses anteriores no cambian.

### Guion de la demo (5 minutos)
1. `npm run importar` para dejar todo limpio. Entrar como Planificación central: panorama nacional.
2. Blue Prism procesa `BUK_Agosto_2026_demo.xlsx` (o el script, como respaldo).
3. **Robot Blue Prism**: 6 errores detectados con su fila (duplicado, horas 60, fecha 31-02, código XX…).
4. **Cambios de BUK**: 6 cambios con su efecto en la meta. Aplicar el cambio de jornada del 71580 (42 → 33 h desde agosto).
5. Abrir el profesional 71580: enero a julio quedan iguales y desde agosto se recalcula.
6. Cargar SIC: el dashboard muestra el cumplimiento y las alertas (Calama y Copiapó bajo la meta).
7. **Parámetros**: simular la meta al 85% antes de guardar. **Auditoría**: quién hizo qué y por qué.

## Cómo correrlo (etapa 1)

Requisito: Node.js 18 o superior.

```bash
cd backend
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run importar            # lee los Excel y crea los JSON en /data
npm start                   # levanta el backend en http://localhost:4000
```

Prueba: abre http://localhost:4000/api/salud en el navegador.
Debe mostrar cuántos registros tiene cada tabla.

## Etapa 2: login y permisos

```bash
npm run usuarios    # crea los 5 usuarios de prueba (clave: Demo2026!)
npm test            # 9 tests de permisos
npm start
```

| Usuario | Rol | Ve |
|---|---|---|
| admin@teleton.cl | ADMIN | Usuarios y auditoría (no ve planificación) |
| planificador@teleton.cl | PLANIFICADOR | Todo el país + edita parámetros |
| dmn@teleton.cl | DMN | Todo el país + aprueba |
| jefatura.ari@teleton.cl | JEFATURA | Solo Arica (IT 11) |
| profesional.71580@teleton.cl | PROFESIONAL | Solo su propia planificación |

Rutas de esta etapa:
- `POST /api/auth/login` → `{ email, password }` devuelve `{ token, usuario, menu, alcance }`
- `GET /api/auth/yo` → usuario conectado y su menú
- `GET /api/profesionales?it=&codEsp=&cargo=` → filtrado por rol en el backend
- `GET /api/profesionales/:personaId` → contratos mes a mes (404 si está fuera de su alcance)
- `GET/POST/PUT /api/usuarios` → solo ADMIN, todo queda en `data/auditoria.json`
- `GET /api/bot/ping` → prueba de conexión de Blue Prism (header `x-api-key`)

Los roles, su alcance y su menú están en `src/permisos.js`.

## Etapa 3: motor de cálculo

```bash
npm run importar    # vuelve a generar los datos (incluye planificacion_base.json)
npm run validar     # compara el cálculo con el Excel, fila por fila
npm test            # 13 tests (2 casos obligatorios + validación global + permisos)
```

### Cómo calcula (por fila y por mes) — `src/servicios/calculo.js`
1. **Horas del mes (HS)**: de BUK (o de Excepciones si es multi-instituto). Los meses que BUK aún no informa repiten el último valor, salvo que el contrato termine.
2. **Promedio ponderado** del período (truncado). Las 44 h de ene–abr cuentan como 42 (la baja legal no es un cambio de jornada).
3. **Tramo** (≥40 / 22–40 / <22) → % Directo, % Indirecto y % NAS del cargo (o los ajustes propios de la fila).
4. **Horas fijas por semana**: NAS = promedio × %NAS; asignaciones = suma de horas (las que requieren DMN solo si están aprobadas).
5. **Horas disponibles** = HS − colación del contrato.
6. **% Asistencial** = 1 − (NAS + asignaciones) / horas disponibles, repartido entre directa e indirecta en proporción a sus %.
7. **Atenciones por semana** = PISO(horas disponibles × % final × 60 / minutos estándar).
8. **Grupal**: directa × (1 − %grupal) + directa × %grupal × pacientes por grupo (Santiago/Concepción u otros IT).
9. **Semanas hábiles** = semanas del mes − ausencias (licencias, vacaciones, permisos, días especiales).
10. **Plan del mes** = PISO(atenciones semana × semanas hábiles). **Meta** = PISO(plan × 90%).
11. **% FOJA** = horas de atención directa / horas contratadas.

### Rutas nuevas
- `GET /api/planificacion?it=&codEsp=&cargo=&detalle=1` (filtrado por rol)
- `GET /api/planificacion/persona/:personaId` (mes a mes)
- `GET /api/parametros` · `PUT /api/parametros/:tabla/:clave` (solo PLANIFICADOR, justificación obligatoria, queda en auditoría)
- `POST /api/simulaciones` → `{ tabla, clave, valores }` devuelve meta nacional y por instituto antes/después, sin guardar

## Qué genera la importación (`backend/data`)

| Archivo | Viene de | Contenido |
|---|---|---|
| institutos.json | Parámetros | IT, abreviatura, nombre y zona (Arica, Ñuble, Aysén o Nacional) |
| homologacion.json | Parámetros | Cod_Esp ↔ Cargo ↔ Centro de costo |
| distribucion.json | Distribucion_NAC | % Dir/Ind/NAS por cargo y tramo + minutos estándar |
| asignaciones_catalogo.json | Distribucion_NAC + dotación | Asignaciones especiales, horas y si requieren DMN |
| factor_grupal.json | Parámetros | % grupal y pacientes por grupo (San-Con / Otros IT) |
| calendario.json | Parámetros | Días y semanas hábiles por mes |
| parametros_generales.json | varios | Meta 90%, jornada 44/42, máx. asignaciones, etc. |
| excepciones.json | Excepciones | Multi-instituto: horas por mes en cada IT |
| dotacion.json | Reporte BUK | Una fila por persona, instituto y mes (ya limpia) |
| referencia_excel.json | Dotacion_Asistencial | Resultados del Excel actual, para validar el cálculo |

## Protección de datos
- No hay nombres ni RUT: se usa `PersonaId`.
- De la fecha de nacimiento solo se guarda el **mes** (día libre de cumpleaños).
