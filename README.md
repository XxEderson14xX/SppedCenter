Sistema Taller Automotriz · README maestro (historial completo)
> **Propósito de este documento:** bitácora viva del proyecto. Cada actualización
> se **agrega** aquí sin borrar lo anterior, para conservar el historial completo:
> qué se hizo, cuándo, y qué objetivos se cumplieron en cada versión.
>
> **Última actualización:** 25 de agosto de 2026 · **Versión vigente: V7**
> **Autor:** Eder Ernesto Castillo Colín
---
🧭 Índice de versiones
Versión	Fecha	Título	Estado
V1	Ago 2026	Esqueleto funcional MVP (frontend + Supabase)	✅ Completada
V2	Ago 2026	Historial por placa, PDF, archivos, RLS reforzado	✅ Completada
V3	Ago 2026	Gestión de usuarios con username y login por usuario	✅ Completada
V4	24 Ago 2026	Alta de usuarios desde el panel de admin (Edge Function)	✅ Completada
V5	24 Ago 2026	Correcciones de bugs + mejoras de cotización y catálogo de autos	✅ Completada
V6	25 Ago 2026	Identidad permanente (VIN / ID cliente) + captura inline desde la cotización	✅ Completada
V7	25 Ago 2026	Administración total de usuarios: borrar + cambiar contraseña + gate de pagos	✅ Completada
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
│   ├── V6_01_base_datos_completo.sql       (V6)
│   └── functions/gestion-usuario/          (V7)
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
📌 Aprendizajes reales de despliegue (aplican a TODAS las Edge Functions)
El slug de una Edge Function no se puede renombrar (si nace `hyper-processor`,
esa es su URL). Ponerle el nombre correcto desde el inicio.
"Failed to fetch" = setting "Verify JWT with legacy secret" activo bloquea
el preflight CORS. Solución: apagarlo (la función ya valida token+rol).
"non-2xx status" al crear usuario = revisar Logs; causa típica: perfil admin
con `activo = null`. Fix: `update public.perfiles set activo = true where activo is null;`
Regla de username
Situación	Resultado (ej. Eder Castillo Colín)
Normal → 1ª letra + apellido	`ecastillo`
Si ya existe → 2ª letra del nombre	`edcastillo`
Si sigue → 3 letras	`edecastillo`
Último recurso → + número	`ecastillo42`
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
`V5_01_base_datos.sql` · `V5_02_parche_frontend.md` · estilos de badges.
`catalogo_autos.csv` — catálogo con 23,990 registros (21 marcas, 185
modelos, 1990-2026, con versiones/trims reales y motores).
🎯 Objetivos de V5
[x] Bugs #1,#2,#4,#5,#6 · Mejoras #3,#7,#8,#9 · Catálogo importado.
---
📦 V6 · Identidad permanente + captura inline desde la cotización  ✅ COMPLETADA
Objetivo: que todo se capture desde la cotización (sin popups ni pasos
previos) y que el historial nunca se rompa, aun cuando cambien datos volátiles
como la placa o el teléfono.
🧠 La regla de oro de V6
> **"La identidad NUNCA cambia; los datos de contacto SÍ."**
Entidad	Identidad permanente (ancla del historial)	Datos que cambian (con historial/alerta)
👤 Cliente	`id` interno (uuid)	Teléfono, correo, dirección, nombre
🚗 Vehículo	VIN / NIV	Placa (con vigencia), color, km
🔑 Decisiones de diseño
VIN como identidad del auto: en México las placas se re-emplacan cada ~5-6
años, pero el auto es el mismo. El VIN es permanente → el historial sobrevive.
Placa temporal: si no hay VIN a la mano, se usa la placa temporalmente y se
agrega el VIN después sin perder historial.
ID interno del cliente como identidad: el teléfono también cambia; el cliente
se ancla a su `uuid`. Teléfono/correo son datos editables con historial.
Anti-duplicado por teléfono: al capturar un cliente nuevo, si el teléfono ya
existe (incluso en teléfonos anteriores), se avisa y se ofrece reutilizarlo.
Un cliente, varios autos: cada auto se liga al mismo cliente sin duplicarlo;
cada placa/VIN conserva su propio historial.
Piezas de V6
`V6_01_base_datos_completo.sql` (con RLS incluido):
`vehiculos.vin` (único parcial) + `vehiculos.version`.
`placas_historial` + `cambiar_placa()` + trigger de siembra.
`telefonos_historial` + `cambiar_telefono()` + trigger de siembra.
`buscar_clientes()`, `telefono_existente()`, `buscar_vehiculo()`.
`resolver_cliente_vehiculo()` → alta integral cliente+auto desde la cotización.
`index.html`, `app.js`, `styles.css` completos con la captura inline.
📌 Aprendizaje de seguridad
Toda tabla nueva debe nacer con RLS + políticas. Supabase avisa "tables
without RLS"; NO usar "Run and enable RLS" (bloquea sin políticas). Incluir las
políticas en el propio script.
🎯 Objetivos de V6
[x] VIN como identidad permanente + historial de placas.
[x] Historial de teléfonos + cambio sin perder historial.
[x] Anti-duplicado de cliente por teléfono/nombre/correo.
[x] Captura de cliente y vehículo inline desde la cotización (sin popups).
[x] Un cliente con varios autos; cada placa/VIN con historial propio.
---
📦 V7 · Administración total de usuarios + gate de pagos  ✅ COMPLETADA
Objetivo (25 Ago 2026): cerrar el módulo de usuarios permitiendo eliminar
usuarios y restablecer contraseñas desde el panel, más una mejora de UX en
las pestañas de la cotización.
🔐 Nuevas capacidades de usuarios
Restablecer contraseña de cualquier usuario (el admin define la nueva).
Eliminar usuario (borra `auth.users` + su perfil), con confirmación.
Por qué necesitó una Edge Function
Borrar usuarios y cambiar contraseñas operan sobre `auth.users`, que solo se puede
tocar con la `service_role` key desde el servidor — nunca desde el frontend.
Piezas de V7
Edge Function `gestion-usuario` (`functions/gestion-usuario/index.ts`):
Acción `cambiar_password` → `admin.auth.admin.updateUserById`.
Acción `eliminar` → borra perfil + `admin.auth.admin.deleteUser`.
Valida sesión + rol administrador activo.
Candado de seguridad: un admin no puede eliminar ni cambiar su propia
cuenta desde el panel (evita quedarse fuera del sistema).
Ediciones frontend (por bloques):
`index.html` → campo "Nueva contraseña" + botón "Restablecer" + botón rojo
"Eliminar usuario" en el modal de perfil.
`styles.css` → estilo `.btn.peligro` (rojo) para el botón eliminar.
`app.js` → limpiar campo password al abrir; listeners de restablecer y eliminar
(con lectura del mensaje real de la función aunque sea non-2xx).
🧩 Mejora de UX incluida (gate de pagos)
En una cotización nueva (sin guardar), las pestañas Pagos / Seguimiento /
Archivos muestran un aviso elegante ("guarda primero la cotización") y sus
botones se ven bloqueados. Al guardar, se activan automáticamente.
(Reemplaza el `alert()` feo por un aviso integrado a la interfaz.)
📌 Aprendizaje de despliegue
El caché de GitHub Pages es agresivo: tras subir `app.js`/`styles.css`, hacer
Ctrl+Shift+R o abrir en incógnito. Un botón que "no hace nada" y una Console
en silencio = versión vieja de JS en caché.
🎯 Objetivos de V7
[x] Restablecer contraseña desde el panel (Edge Function segura).
[x] Eliminar usuario desde el panel (con confirmación y candado anti-autoborrado).
[x] Gate de pestañas Pagos/Seguimiento/Archivos (aviso + botón bloqueado).
[x] Probado en producción (funcionando tras limpiar caché).
---
🗺️ Backlog / próximos pasos (acumulado)
[ ] Botones de UI para `cambiar_placa()` y `cambiar_telefono()` en las fichas.
[ ] Soporte de `.xlsx` real (SheetJS) en importación masiva.
[ ] Permiso dedicado para "cierre con adeudo".
[ ] Recordatorios de fecha compromiso de adeudos.
[ ] Reportes descargables (Excel) de cotizaciones, pagos o catálogo.
[ ] Reforzar reglas de cierre con trigger en Postgres (hoy solo en frontend).
[ ] Opción de link de recuperación por correo para contraseñas (además del reset directo).
[ ] Guía en Word/PDF para el equipo de desarrollo.
---
📝 Convención para futuras versiones (V8+)
Agregar bloque `# 📦 Vn · Título` al final (nunca borrar lo anterior).
Actualizar el índice de versiones.
Listar objetivos con `[ ]`/`[x]`.
Mover pendientes abiertos a "Backlog".
Actualizar fecha y "Versión vigente" del encabezado.
Convención de edición de código (acordada con Eder): para cambios por bloques
se indica siempre: archivo exacto, ubicación/sección, texto exacto a buscar, texto
exacto a reemplazar/insertar, y cómo verificar. También se pueden entregar archivos
completos cuando aplique.
---
⚙️ Guía de instalación desde cero (referencia rápida)
Crear proyecto en Supabase.
SQL Editor → Run en orden: `schema.sql` → `actualizacion_permisos_archivos.sql`
→ `actualizacion_usuarios.sql` → `01_funciones_admin.sql` → `V5_01_base_datos.sql`
→ `V6_01_base_datos_completo.sql`.
Desplegar Edge Functions `crear-usuario` y `gestion-usuario`
(apagar "Verify JWT with legacy secret" en ambas).
Crear primer admin: `update public.perfiles set rol='administrador', activo=true where id='UUID';`
Importar `catalogo_autos.csv` a la tabla `catalogo_autos`.
Configurar `assets/config.js` (Project URL + anon key; nunca la service_role).
Subir `index.html`, `assets/app.js`, `assets/styles.css` a GitHub Pages.
Tras cada actualización de front: Ctrl+Shift+R para evitar caché.
