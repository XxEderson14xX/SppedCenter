Sistema Taller Automotriz (SpeedCenter) · README maestro (historial completo)
> **Propósito de este documento:** bitácora viva del proyecto. Cada actualización
> se **agrega** aquí sin borrar lo anterior, para conservar el historial completo:
> qué se hizo, cuándo, y qué objetivos se cumplieron en cada versión.
>
> **Última actualización:** 9 de septiembre de 2026 · **Versión vigente: V11.3**
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
V8–V10	Ago–Sep 2026	Catálogo Maestro (servicios/mano de obra/refacciones/combos), Órdenes de Trabajo, descuentos, Herramienta Especial, carga operativa, ingresos	✅ Completadas (ver nota)
V11	Sep 2026	Herramienta Especial rediseñada (identificador automático + historial de préstamos)	✅ Completada
V11.1	Sep 2026	PDF de Cotización estilo SpeedCenter (logo, folio auto-ajuste, IVA, anticipo 50%) + favicon	✅ Completada
V11.2	Sep 2026	Orden de Trabajo estilo SpeedCenter (fechas, técnico, firmas) + permisos por rol (cotización y OT) + piezas asignadas + historial de clientes	✅ Completada
V11.3	9 Sep 2026	Branding completo SpeedCenter: nombre, paleta de colores ergonómica, logo como botón Home	✅ Completada
> **Nota de transparencia sobre V8–V10:** estas versiones ya existían en el
> código (`app.js`/`v9.js` las referencian) antes de esta sesión de trabajo,
> pero no se documentaron en su momento con el mismo detalle que V1–V7. Se
> reconstruyó su alcance a partir del código fuente vigente (ver resumen más
> abajo). Si en algún momento aparecen los README/commits originales de esas
> versiones, se puede enriquecer esta sección sin perder lo aquí anotado.
---
🏗️ Arquitectura general (constante en todas las versiones)
Frontend estático (para GitHub Pages) + Supabase como backend
(Postgres + Auth + Storage).
```
taller-mvp/
├── index.html
├── favicon.ico, favicon-16x16.png, favicon-32x32.png,
│   apple-touch-icon.png, android-chrome-*.png, site.webmanifest   (V11.1)
├── assets/
│   ├── app.js
│   ├── v9.js
│   ├── config.js
│   ├── styles.css
│   └── logo.png                                                  (V11.1+)
├── supabase/
│   ├── schema.sql                          (V1)
│   ├── actualizacion_permisos_archivos.sql (V2)
│   ├── actualizacion_usuarios.sql          (V3)
│   ├── 01_funciones_admin.sql              (V4)
│   ├── functions/crear-usuario/            (V4)
│   ├── V5_01_base_datos.sql                (V5)
│   ├── V6_01_base_datos_completo.sql       (V6)
│   ├── functions/gestion-usuario/          (V7)
│   └── orden_trabajo_piezas.sql            (V11.2)
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
📦 V4 · Alta de usuarios desde el panel (Edge Function segura) ✅ COMPLETADA
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
📦 V5 · Correcciones de bugs + catálogo de autos ✅ COMPLETADA
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
📦 V6 · Identidad permanente + captura inline desde la cotización ✅ COMPLETADA
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
📦 V7 · Administración total de usuarios + gate de pagos ✅ COMPLETADA
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
📦 V8–V10 · Catálogo Maestro, Órdenes de Trabajo y Herramienta Especial (resumen consolidado)
> Ver nota de transparencia al inicio del documento: estas versiones ya
> existían en el código antes de esta sesión de trabajo. Este bloque resume
> su alcance según lo observado en el código fuente vigente.
Catálogo Maestro V10
Unifica servicios, mano de obra, refacciones/consumibles y combos en
una sola estructura (`v10_catalogo_listar`, `v10_catalogo_guardar`).
Categorías propias, estado activo/inactivo, y expansión automática de
combos hacia los conceptos de una cotización (`expandir_combo`).
Importación masiva por CSV con columnas `codigo,nombre,tipo,categoria,estado`.
Órdenes de Trabajo (capa "V9")
Generación de OT a partir de una cotización autorizada
(`generar_orden_trabajo`).
Checklist de trabajos con avance en tiempo real, "Seleccionar todos",
guardado de avance y finalizado (`guardar_avance_orden`, `finalizar_orden`).
Asignación de técnico responsable por orden.
Adicionales de cotización: piezas/trabajos extra detectados durante el
servicio, con flujo de autorización (`resolver_adicional`).
Descuento general aplicado sobre el primer renglón de la cotización
(compatible con V8), con bloqueo de edición una vez autorizada.
Herramienta Especial (base)
Inventario de herramientas con estado (disponible / prestada / fuera de
servicio), préstamo y devolución ligados a técnico y, opcionalmente, a
una orden de trabajo (`prestar_herramienta`, `devolver_herramienta`).
Operación y caja
Carga de trabajo: vista operativa por técnico (órdenes abiertas,
trabajos pendientes, órdenes atendidas en el mes), explícitamente sin
ranking ni evaluación de desempeño.
Ingresos: consulta de pagos del día por método (efectivo,
transferencia, tarjeta, depósito), sin edición desde esa vista.
Dashboard operativo: KPIs de OT abiertas, trabajos pendientes, OT
terminadas hoy, ingresos del día, estado de herramientas y últimos pagos
(`dashboard_v9`).
🎯 Objetivos de V8–V10 (según código vigente)
[x] Catálogo Maestro unificado con combos.
[x] Órdenes de Trabajo con checklist y avance.
[x] Herramienta Especial con préstamo/devolución básicos.
[x] Carga de trabajo e Ingresos como vistas operativas.
---
📦 V11 · Herramienta Especial rediseñada ✅ COMPLETADA
Objetivo: resolver el error `23502` (violación de `NOT NULL` en la columna
`codigo`) y modernizar el módulo con datos de identificación reales de una
herramienta física.
Cambios
Identificador automático: se genera un código único (`HER-XXXXXXXXXXXX`)
antes del `INSERT`, visible en el formulario desde que se abre "Nueva
herramienta" (ya no depende de que el usuario lo capture a mano).
Nuevos campos: número de serie, marca, modelo, ubicación.
Historial de herramienta: nuevo modal con tabla de movimientos
(salida, devolución, técnico, orden, quién entregó/recibió, observaciones),
respaldado por la función `v11_herramienta_historial(uuid)` en Supabase.
📌 Aprendizaje de base de datos
`CREATE OR REPLACE FUNCTION` no puede cambiar el tipo de retorno (columnas
de un `RETURNS TABLE`). Cuando eso ocurre (`42P13`), es necesario un
`DROP FUNCTION IF EXISTS` explícito antes de volver a crearla.
🎯 Objetivos de V11
[x] Identificador automático de herramienta (elimina el bug 23502).
[x] Campos de serie/marca/modelo/ubicación.
[x] Historial de préstamos y devoluciones por herramienta.
---
📦 V11.1 · PDF de Cotización estilo SpeedCenter + Favicon ✅ COMPLETADA
Objetivo: que el PDF de cotización tenga el mismo diseño profesional que la
papelería física del taller (logo, encabezado, tabla de cliente/vehículo,
tabla de conceptos, totales y términos y condiciones).
Diseño del PDF
Encabezado con logo + nombre/dirección/teléfono en rojo de marca.
Tabla de datos: nombre del cliente, fecha, número de cotización (folio con
auto-ajuste de tamaño de letra para que nunca se desborde de su celda),
placas y automóvil.
Tabla de conceptos: cantidad, descripción, importe unitario, total.
Bloques de totales separados y sin encimarse: SUBTOTAL / IVA (16%) /
ANTICIPO (lo ya pagado) a la izquierda; IMPORTE TOTAL / ANTICIPO REQUERIDO
en rojo a la derecha.
Regla de negocio del anticipo: el ANTICIPO REQUERIDO es siempre el
50% del importe total, de forma fija, independiente de lo que ya se
haya pagado (ese dato se muestra aparte, en la casilla ANTICIPO).
Los 11 términos y condiciones del taller, con el último punto en negritas.
Favicon
Generación de `favicon.ico` + variantes (16x16, 32x32, apple-touch-icon,
android-chrome, `site.webmanifest`) a partir del logo, todos en la raíz
del repositorio y referenciados desde `<head>` con `?v=` para romper caché.
📌 Aprendizajes de esta versión
El PDF puede requerir varias iteraciones de ajuste fino (tamaño de folio,
separación de bloques de totales) antes de igualar un diseño físico
existente; conviene validar contra una foto/PDF real del documento actual.
Un favicon debe ser cuadrado; un logo rectangular con texto se ve
distorsionado al forzarlo a 16×16/32×32.
🎯 Objetivos de V11.1
[x] PDF de cotización con diseño SpeedCenter (logo, tablas, totales, términos).
[x] Folio con ajuste automático de tamaño (nunca se desborda).
[x] Anticipo requerido = 50% del total, independiente de lo ya pagado.
[x] Favicon correcto en todas las resoluciones estándar.
---
📦 V11.2 · Orden de Trabajo SpeedCenter + Permisos por rol + Piezas + Historial de clientes ✅ COMPLETADA
Objetivo: profesionalizar la impresión de la Orden de Trabajo, cerrar huecos
de seguridad visual por rol, y enlazar refacciones de la cotización con el
trabajo real del técnico.
Orden de Trabajo · Diseño e impresión
Rediseño completo del documento impreso: logo, encabezado SpeedCenter,
fecha de la orden, datos de cliente y teléfono, vehículo completo (marca,
modelo, placas, VIN, kilometraje), técnico asignado, fecha de
entrega estimada (tomada de la cotización), folio de cotización de
referencia, barra de avance, checklist de trabajos y espacio de firmas
(cliente y técnico).
Corrección de bug de cuelgue: "Guardar avance" y "Finalizar" se
reescribieron con un candado anti-doble-clic (`otEnProceso`) y bloque
`try/catch/finally` que siempre libera los botones, eliminando el
congelamiento que ocurría al guardar sin cambios o al usar "Seleccionar
todos" antes de finalizar.
Corrección de bug de impresión: se ajustó el orden de
`document.close()` antes de `print()` para que la ventana de impresión ya
no bloquee la pestaña principal del sistema.
Piezas / refacciones asignadas (nuevo)
Nueva tabla `orden_trabajo_piezas` (nombre + cantidad) dentro del modal de
la Orden de Trabajo.
Sincronización automática: al crear la Orden de Trabajo, se copian de
forma automática los conceptos de la cotización cuyo tipo sea
`refaccion_libre` o `consumible` (se excluyen `servicio`, `mano_obra`,
`descuento` y `nota`), evitando captura doble.
Botón opcional "🔄 Sincronizar desde cotización" para volver a jalar los
cambios si la cotización se edita después de creada la OT.
Solo Recepción/Administrador pueden agregar o quitar piezas; el
técnico las ve en modo solo lectura. Las piezas también se imprimen en el
PDF de la orden.
Permisos por rol (frontend)
Cotización: se bloquea la edición de cliente, vehículo, kilometraje y
fecha de entrega cuando el estado comercial es Autorizada, Cerrada,
Cancelada o Rechazada (el Administrador siempre puede editar, para
corregir errores). Adicionalmente, los roles Consulta y Técnico
quedan en solo lectura total dentro del modal de cotización (no pueden
crear cotizaciones nuevas, ni ver/operar la pestaña de Pagos); solo pueden
ver datos y descargar el PDF.
Orden de Trabajo: el rol Consulta solo puede ver e imprimir (no
marca checklist, no cambia técnico, no guarda avance ni finaliza).
Recepción, Administrador y Técnico sí pueden operar la orden.
Se muestra el técnico asignado directamente en la cotización (tomado
de la última orden de trabajo ligada), sin necesidad de abrir la OT.
Historial de clientes (nuevo)
Nuevo botón "Historial" en la tabla de Clientes que reutiliza el modal de
historial ya existente para vehículos, pero agregando todos los autos
del cliente y todas sus cotizaciones en una sola vista de principio a
fin (KPIs de visitas, total facturado histórico y saldo pendiente
acumulado, lista de vehículos, línea de tiempo de seguimiento).
📌 Aprendizaje importante de esta versión (seguridad)
Todo el bloqueo de permisos por rol descrito aquí es frontend/UI
únicamente: mejora la experiencia y evita errores de captura, pero no es
seguridad real, ya que un usuario con conocimientos técnicos podría
saltárselo llamando directo a la API de Supabase. La seguridad real debe
reforzarse con políticas RLS en las tablas correspondientes (pendiente,
ver Backlog).
🎯 Objetivos de V11.2
[x] Orden de Trabajo con diseño SpeedCenter completo (fechas, técnico, firmas).
[x] Corrección del cuelgue al guardar/finalizar la orden.
[x] Corrección del congelamiento de la página al imprimir.
[x] Piezas asignadas con sincronización automática desde la cotización.
[x] Permisos de solo lectura para Consulta (y Técnico en cotización).
[x] Historial completo de clientes (todos sus autos y cotizaciones).
---
📦 V11.3 · Branding SpeedCenter (nombre, colores, logo como Home) ✅ COMPLETADA
Objetivo: reemplazar la identidad genérica ("Taller Automotriz", azul/verde
de plantilla) por la marca real del negocio, cuidando la ergonomía visual
para jornadas de 8 horas frente a la pantalla.
Decisión de diseño (branding vs. interfaz)
Se separó el color de marca puro (usado en fachada, uniformes y PDFs)
del color de interfaz (usado en el sistema web), siguiendo la práctica
de sistemas internos de marcas automotrices: reservar el rojo/negro "puro"
para los puntos de identidad (logo, botón principal, selección activa) y
usar tonos neutros para las áreas de trabajo grandes, evitando fatiga visual
y la confusión con los colores de alerta/error ya usados en los badges de
estado del sistema.
Elemento	Antes	Ahora (SpeedCenter)
Menú lateral / encabezados	Azul marino genérico `#0f2a4a`	Gris carbón cálido `#211E1E`
Botones principales / acento activo	Verde-azulado genérico `#1b6f7a`	Rojo SpeedCenter `#D32F2F`
Fondo de trabajo	Gris niebla `#f4f6f8`	Gris niebla `#F4F6F8` (sin cambio)
Alertas de error	`#c0392b`	`#C0392B` (se conserva, deliberadamente distinto al rojo de marca)
Cambios aplicados
Nombre: "Taller Automotriz" → SpeedCenter en el título de la
pestaña del navegador, la pantalla de login y el menú lateral.
Logo como botón de Home: el logo en el menú lateral ahora es un enlace
clickeable que lleva directamente al módulo de Inicio (simula el clic del
`nav-item` correspondiente).
"Racing stripe": franja de 3px en el color de marca en la parte
superior de cada panel/tarjeta del sistema (Dashboard, Cotizaciones, etc.),
como acento sutil de identidad sin saturar de color las áreas de trabajo.
Los nombres de las variables CSS existentes (`--navy`, `--teal`, etc.) se
conservaron; solo se reemplazaron sus valores, de modo que el cambio de
paleta se propaga automáticamente a botones, badges y menú sin tocar cada
regla de estilo de forma individual.
🎯 Objetivos de V11.3
[x] Nombre "SpeedCenter" en pestaña, login y menú.
[x] Logo del taller como botón de acceso rápido a Inicio.
[x] Paleta de colores ergonómica basada en la marca, sin fatiga visual.
[x] Franja de acento ("racing stripe") en los paneles principales.
---
🗺️ Backlog / próximos pasos (acumulado)
[ ] Seguridad real con RLS: reforzar en Supabase las políticas de
`cotizaciones`, `pagos`, `detalle_cotizacion`, `ordenes_trabajo` y
`orden_trabajo_piezas` para que los roles Consulta y Técnico no puedan
crear/editar aunque se salten el frontend (hoy el bloqueo es solo
visual, ver aprendizaje de V11.2).
[ ] Botones de UI para `cambiar_placa()` y `cambiar_telefono()` en las fichas.
[ ] Soporte de `.xlsx` real (SheetJS) en importación masiva.
[ ] Permiso dedicado para "cierre con adeudo".
[ ] Recordatorios de fecha compromiso de adeudos.
[ ] Reportes descargables (Excel) de cotizaciones, pagos o catálogo.
[ ] Reforzar reglas de cierre con trigger en Postgres (hoy solo en frontend).
[ ] Opción de link de recuperación por correo para contraseñas (además del reset directo).
[ ] Guía en Word/PDF para el equipo de desarrollo.
[ ] Revisar permisos por rol en Clientes/Vehículos/Catálogo/Herramientas
(confirmar qué puede tocar cada rol fuera de Cotización y Orden de Trabajo).
[ ] Definir si el nombre "SPEED CENTER" (con espacio, en los PDFs) debe
unificarse exactamente con "SpeedCenter" (sistema web) o mantenerse
como convención tipográfica distinta para impresos.
---
📝 Convención para futuras versiones (V12+)
Agregar bloque `# 📦 Vn · Título` al final (nunca borrar lo anterior).
Actualizar el índice de versiones.
Listar objetivos con `[ ]`/`[x]`.
Mover pendientes abiertos a "Backlog".
Actualizar fecha y "Versión vigente" del encabezado.
Convención de edición de código (acordada con Eder): para cambios por bloques
se indica siempre: archivo exacto, ubicación/sección, texto exacto a buscar, texto
exacto a reemplazar/insertar, y cómo verificar. También se pueden entregar archivos
completos cuando aplique. Los archivos grandes se entregan siempre para
descargar/subir directo a GitHub, nunca pegados en el chat (para evitar
que el formateo del chat rompa comillas, `<script>` o saltos de línea).
---
⚙️ Guía de instalación desde cero (referencia rápida)
Crear proyecto en Supabase.
SQL Editor → Run en orden: `schema.sql` → `actualizacion_permisos_archivos.sql`
→ `actualizacion_usuarios.sql` → `01_funciones_admin.sql` → `V5_01_base_datos.sql`
→ `V6_01_base_datos_completo.sql` → (scripts de Catálogo Maestro / Órdenes de
Trabajo / Herramienta Especial vigentes) → `orden_trabajo_piezas.sql` (V11.2).
Desplegar Edge Functions `crear-usuario` y `gestion-usuario`
(apagar "Verify JWT with legacy secret" en ambas).
Crear primer admin: `update public.perfiles set rol='administrador', activo=true where id='UUID';`
Importar `catalogo_autos.csv` a la tabla `catalogo_autos`.
Configurar `assets/config.js` con las credenciales de tu proyecto Supabase:
```js
   const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
   const SUPABASE_ANON_KEY = "TU_ANON_PUBLIC_KEY";
   ```
> La `anon key` es pública por diseño (Supabase la protege con las
   > políticas RLS del schema). **Nunca** pongas aquí la `service_role` key;
   > esa solo vive del lado del servidor, dentro de las Edge Functions.
Subir a GitHub Pages (raíz del repositorio):
`index.html`
`assets/app.js`, `assets/v9.js`, `assets/config.js`, `assets/styles.css`, `assets/logo.png`
`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`,
`apple-touch-icon.png`, `android-chrome-192x192.png`,
`android-chrome-512x512.png`, `site.webmanifest`
Tras cada actualización de front: Ctrl+Shift+R (o modo incógnito) para
evitar que el navegador cargue una versión vieja de `app.js`/`v9.js`/`styles.css`
desde caché. Si el problema persiste, agregar/incrementar el parámetro de
versión en la URL del script, por ejemplo `assets/app.js?v=11.3`.
Estructura de carpetas del proyecto (referencia rápida)
```
taller-mvp/                        ← raíz del repositorio (GitHub Pages)
├── index.html                     ← única página de la aplicación (SPA)
├── favicon.ico                    ← V11.1
├── favicon-16x16.png              ← V11.1
├── favicon-32x32.png              ← V11.1
├── apple-touch-icon.png           ← V11.1
├── android-chrome-192x192.png     ← V11.1
├── android-chrome-512x512.png     ← V11.1
├── site.webmanifest               ← V11.1
├── assets/
│   ├── app.js                     ← módulos: auth, clientes, vehículos,
│   │                                catálogo maestro, cotizaciones, pagos,
│   │                                seguimiento, archivos, PDF, usuarios,
│   │                                bitácora, combos, permisos, branding
│   ├── v9.js                      ← módulos: dashboard, descuentos,
│   │                                adicionales, Órdenes de Trabajo, piezas,
│   │                                carga operativa, ingresos, herramienta
│   │                                especial, impresión de OT
│   ├── config.js                  ← credenciales de Supabase (URL + anon key)
│   ├── styles.css                 ← paleta de colores y estilos globales
│   └── logo.png                   ← logo SpeedCenter (branding + PDFs)
├── supabase/
│   ├── schema.sql
│   ├── actualizacion_permisos_archivos.sql
│   ├── actualizacion_usuarios.sql
│   ├── 01_funciones_admin.sql
│   ├── V5_01_base_datos.sql
│   ├── V6_01_base_datos_completo.sql
│   ├── orden_trabajo_piezas.sql    ← V11.2 (tabla + políticas RLS)
│   └── functions/
│       ├── crear-usuario/
│       └── gestion-usuario/
└── README.md
```
