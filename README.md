Sistema Taller Automotriz · README maestro (historial completo)
> **Propósito de este documento:** bitácora viva del proyecto. Cada actualización
> se **agrega** aquí sin borrar lo anterior, para conservar el historial completo:
> qué se hizo, cuándo, y qué objetivos se cumplieron en cada versión.
>
> **Última actualización:** 25 de agosto de 2026 · **Versión vigente: V6**
> **Autor:** Eder Ernesto Castillo Colín
---
🧭 Índice de versiones
Versión	Fecha	Título	Estado
V1	Ago 2026	Esqueleto funcional MVP (frontend + Supabase)	✅ Completada
V2	Ago 2026	Historial por placa, PDF, archivos, RLS reforzado	✅ Completada
V3	Ago 2026	Gestión de usuarios con username y login por usuario	✅ Completada
V4	24 Ago 2026	Alta de usuarios desde el panel de admin (Edge Function)	✅ Completada
V5	24 Ago 2026	Correcciones de bugs + mejoras de cotización, clientes y catálogo de autos	✅ Completada
V6	25 Ago 2026	Identidad permanente (VIN / ID cliente) + captura inline desde la cotización	🔧 En desarrollo
---
🏗️ Arquitectura general (constante en todas las versiones)
Frontend estático (para GitHub Pages) + Supabase como backend
(Postgres + Auth + Storage).
```
taller-mvp/
├── index.html
├── assets/ (app.js, config.js, styles.css)
├── supabase/
│   ├── schema.sql                          (V1)
│   ├── actualizacion_permisos_archivos.sql (V2)
│   ├── actualizacion_usuarios.sql          (V3)
│   ├── 01_funciones_admin.sql              (V4)
│   ├── functions/crear-usuario/            (V4)
│   ├── V5_01_base_datos.sql                (V5)
│   └── V6_01_base_datos.sql                (V6)
└── README.md
```
---
📦 V1 · Esqueleto funcional MVP
Objetivo: esqueleto completo del sistema, para profundizar módulo por módulo.
Módulos: Login/Auth, Dashboard, Clientes, Vehículos, Cotizaciones (folio
automático), Pagos/saldo, Seguimiento, Catálogo de servicios, Importación CSV,
Bitácora, Roles (admin/recepción/consulta).
Base de datos (`schema.sql`): tablas core, `siguiente_folio()`, trigger
`handle_new_user()`, RLS básico. IDs internos `uuid` en todas las tablas.
✅ Objetivos cumplidos en V1
[x] Esqueleto completo navegable · Login · CRUD base · Folio automático · Roles/RLS inicial.
---
📦 V2 · Historial, PDF, archivos y seguridad reforzada
Historial por placa, PDF de cotización (jsPDF), archivos adjuntos (Storage
bucket `evidencias`), RLS endurecido, reglas de cierre. Script:
`actualizacion_permisos_archivos.sql`.
✅ Objetivos cumplidos en V2
[x] Historial a detalle · PDF · Evidencia fotográfica · Reglas de cierre · RLS real.
---
📦 V3 · Gestión de usuarios con username
Login por usuario o correo; columnas `username`/`correo`; funciones
`correo_por_username`, `username_disponible`, `listar_usuarios`,
`actualizar_perfil`; generador de username. Script: `actualizacion_usuarios.sql`.
✅ Objetivos cumplidos en V3
[x] Login por username/correo · Admin de perfiles · Generación/validación de username.
---
📦 V4 · Alta de usuarios desde el panel (Edge Function segura)  ✅ COMPLETADA
Edge Function `crear-usuario` (service_role en el servidor), función `es_admin()`,
modal de creación con generador de username.
📌 Aprendizajes reales de despliegue
El slug de una Edge Function no se puede renombrar (si nace `hyper-processor`,
esa es su URL). Ajustar el `invoke()` o recrearla con el nombre correcto.
"Failed to fetch" = setting "Verify JWT with legacy secret" activo bloquea
el preflight CORS. Solución: apagarlo (la función ya valida token+rol).
"non-2xx status" al crear usuario = revisar Logs; causa típica: perfil admin
con `activo = null`. Fix: `update public.perfiles set activo = true where activo is null;`
🎯 Objetivos de V4
[x] `es_admin()` · Edge Function segura · Modal de creación · Username automático · Probado en producción.
---
📦 V5 · Correcciones de bugs + catálogo de autos  ✅ COMPLETADA
🐛 Bugs corregidos
#1 Cantidad entera (no decimales).
#2 Importe por renglón se actualiza en vivo (cantidad × precio).
#4 Dashboard/tabla consistentes con el saldo real (pagos válidos).
#5 Filtro por estado de pago en Cotizaciones.
#6 Columna "Saldo" muestra el adeudo real.
💡 Mejoras
#3/#7 Crear cliente desde la cotización · #8 Diferenciar homónimos.
#9 Catálogo de autos en cascada (Año→Marca→Modelo→Versión→Motor) + alta rápida.
Piezas
`V5_01_base_datos.sql` · `V5_02_parche_frontend.md` · `V5_estilos_badges.css`
`catalogo_autos.csv` — catálogo con 23,990 registros (21 marcas, 185
modelos, 1990-2026, con versiones/trims reales y motores).
🎯 Objetivos de V5
[x] Todos los bugs #1,#2,#4,#5,#6 · Mejoras #3,#7,#8,#9 · Catálogo importado.
---
📦 V6 · Identidad permanente + captura inline desde la cotización  🔧 EN DESARROLLO
Objetivo (25 Ago 2026): rediseñar el flujo para que todo se capture desde la
cotización (sin popups ni pasos previos) y garantizar que el historial nunca se
rompa, aun cuando cambien datos volátiles como la placa o el teléfono.
🧠 La regla de oro de V6
> **"La identidad NUNCA cambia; los datos de contacto SÍ."**
Entidad	Identidad permanente (ancla del historial)	Datos que cambian (con historial/alerta)
👤 Cliente	`id` interno (uuid)	Teléfono, correo, dirección, nombre
🚗 Vehículo	VIN / NIV	Placa (con vigencia), color, km
🔑 Decisiones de diseño (y por qué)
VIN como identidad del auto: en México las placas se re-emplacan cada ~5-6
años, pero el auto es el mismo. El VIN (17 caracteres) es permanente, así el
historial de servicios sobrevive a cualquier cambio de placa.
Placa temporal: si el cliente no trae el VIN a la mano, se crea el auto con
la placa como identificador temporal y luego se agrega el VIN sin perder historial.
→ No se frena la cotización rápida.
ID interno del cliente como identidad: el teléfono también cambia. Por eso
el cliente se ancla a su `uuid` permanente; teléfono/correo son datos editables.
Anti-duplicado por teléfono: al capturar un cliente nuevo, si el teléfono ya
existe (incluso en teléfonos anteriores), el sistema avisa y ofrece reutilizarlo.
El teléfono se usa para alertar, no como identidad.
Un cliente, varios autos: cada auto se liga al mismo cliente sin duplicarlo;
cada placa/VIN conserva su propio historial (el historial cuelga del auto).
Piezas de V6
`V6_01_base_datos.sql`
`vehiculos.vin` (único parcial) + `vehiculos.version`.
Tabla `placas_historial` + `cambiar_placa()` + trigger que siembra la placa inicial.
Tabla `telefonos_historial` + `cambiar_telefono()` + trigger que siembra el teléfono inicial.
`buscar_clientes()` / `telefono_existente()` → anti-duplicado por tel/nombre/correo.
`buscar_vehiculo()` → encuentra el auto por placa actual, placa vieja o VIN.
`resolver_cliente_vehiculo()` → alta integral cliente+auto desde la cotización
(crea lo que falte, sin duplicar, en una transacción).
`V6_02_cotizacion_inline.md` — rediseño de la pestaña "Datos y conceptos":
cliente inline (buscar/crear), vehículo inline (autos del cliente / nuevo con
cascada), alertas de duplicado por teléfono y VIN, estilos y lógica de guardado.
Flujo nuevo (un solo lugar, un solo clic)
Cliente: buscas por nombre/teléfono/correo → si existe lo eliges; si no,
capturas sus datos inline (con alerta anti-duplicado por teléfono).
Vehículo: eliges uno de los autos del cliente o creas uno nuevo con la
cascada del catálogo + placa (+ VIN recomendado).
Guardar cotización: `resolver_cliente_vehiculo()` crea lo que falte sin
duplicar y la cotización queda ligada al auto correcto (con su historial propio).
🎯 Objetivos de V6
[x] VIN como identidad permanente del auto (único parcial).
[x] Historial de placas + `cambiar_placa()` (re-emplacamiento sin perder historial).
[x] Historial de teléfonos + `cambiar_telefono()` (cambio de número sin perder historial).
[x] Anti-duplicado de cliente por teléfono/nombre/correo.
[x] Captura de cliente y vehículo inline desde la cotización (sin popups).
[x] Un cliente con varios autos; cada placa/VIN con historial propio.
[ ] Pendiente: aplicar el parche frontend, correr el SQL y probar en producción.
[ ] Pendiente (futuro): UI para "cambiar placa" y "cambiar teléfono" desde
las fichas de vehículo y cliente (las funciones ya existen en la BD).
---
🗺️ Backlog / próximos pasos (acumulado)
[ ] Botones de UI para `cambiar_placa()` y `cambiar_telefono()` en las fichas.
[ ] Soporte de `.xlsx` real (SheetJS) en importación masiva.
[ ] Permiso dedicado para "cierre con adeudo".
[ ] Recordatorios de fecha compromiso de adeudos.
[ ] Reportes descargables (Excel).
[ ] Reforzar reglas de cierre con trigger en Postgres (hoy solo en frontend).
[ ] Guía en Word/PDF para el equipo de desarrollo.
[ ] (V6) Aplicar parche + probar en producción.
---
📝 Convención para futuras versiones (V7+)
Agregar bloque `# 📦 Vn · Título` al final (nunca borrar lo anterior).
Actualizar el índice de versiones.
Listar objetivos con `[ ]`/`[x]`.
Mover pendientes abiertos a "Backlog".
Actualizar fecha y "Versión vigente" del encabezado.
---
⚙️ Guía de instalación desde cero (referencia rápida)
Crear proyecto en Supabase.
SQL Editor → Run en orden: `schema.sql` → `actualizacion_permisos_archivos.sql`
→ `actualizacion_usuarios.sql` → `01_funciones_admin.sql` → `V5_01_base_datos.sql`
→ `V6_01_base_datos.sql`.
Desplegar Edge Function `crear-usuario` (apagar "Verify JWT with legacy secret").
Crear primer admin y marcarlo: `update public.perfiles set rol='administrador', activo=true where id='UUID';`
Importar `catalogo_autos.csv` a la tabla `catalogo_autos`.
Configurar `assets/config.js` (Project URL + anon key; nunca la service_role).
Aplicar el parche `V6_02_cotizacion_inline.md` a `index.html`/`app.js`/`styles.css`.
Publicar en GitHub Pages.
