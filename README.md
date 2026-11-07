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
└── docs/                       ← (etapa 4) contrato-bot.md para Blue Prism
```

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
