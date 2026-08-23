# Sistema Taller Automotriz · MVP V1 (esqueleto)

Esqueleto funcional del sistema descrito en la especificación: frontend estático
(para GitHub Pages) + Supabase como backend (Postgres + Auth), igual que el patrón
de tu dashboard PrimeMX pero con datos compartidos en Supabase en vez de solo
un backend propio.

## Qué incluye este esqueleto

| Módulo | Estado |
|---|---|
| Login / sesión (Supabase Auth) | Funcional |
| Dashboard con KPIs y actividad reciente | Funcional (básico) |
| Clientes (alta, edición, búsqueda) | Funcional |
| Vehículos (alta, edición, búsqueda, gancho de historial) | Funcional |
| Cotizaciones (folio automático, conceptos, totales, estados) | Funcional (básico) |
| Pagos y saldo por cotización (incluye reversos) | Funcional |
| Seguimiento (línea de tiempo por cotización) | Funcional |
| Catálogo de servicios | Funcional |
| Importación masiva (CSV) | Funcional, validación básica |
| Bitácora | Funcional (registro manual desde el frontend) |
| Roles (administrador / recepción / consulta) | Estructura lista; permisos finos pendientes de afinar |
| Vista de historial por placa a detalle, PDF de cotización, archivos adjuntos | **Pendiente** — quedan los enlaces de datos listos para construir encima |

Es intencionalmente básico en cada módulo, tal como pediste, para tener el
esqueleto completo primero y profundizar módulo por módulo después.

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta / proyecto nuevo (plan gratis).
2. Ve a **SQL Editor → New query**, pega el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo.
3. Ve a **Authentication → Users → Add user** y crea tu primer usuario
   (correo + contraseña). Ese será tu login inicial.
4. Copia el UUID de ese usuario (columna `UID` en la tabla de usuarios) y en
   **SQL Editor** corre:
   ```sql
   update public.perfiles set rol = 'administrador' where id = 'PEGA-AQUI-EL-UUID';
   ```
   Esto lo convierte en administrador (el trigger del esquema ya le creó un
   perfil con rol "consulta" automáticamente; este paso lo sube a admin).
5. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**

## 2. Configurar el frontend

Abre `assets/config.js` y reemplaza:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-KEY-PUBLICA";
```

con los valores reales de tu proyecto. La `anon key` es pública por diseño
(la seguridad real la dan las políticas RLS del `schema.sql`); nunca pongas
aquí la `service_role key`.

## 3. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser público o privado; si es
   privado necesitas GitHub Pro/Team para activar Pages).
2. Sube el contenido de esta carpeta tal cual (`index.html`, `assets/`, `README.md`).
   No subas `supabase/schema.sql` como secreto — no tiene datos sensibles,
   pero si prefieres puedes dejarlo fuera del repo público, ya lo tienes local.
3. Ve a **Settings → Pages** en el repo, elige la rama `main` y carpeta `/root`.
4. En un par de minutos tu sistema estará en algo como:
   `https://tu-usuario.github.io/nombre-del-repo/`

## 4. Usarlo

- Entra con el correo/contraseña que creaste en el paso 1.
- Da de alta clientes y vehículos primero.
- Carga el catálogo (a mano o con **Importación masiva**, subiendo un CSV con
  columnas: `codigo, nombre, descripcion, categoria, unidad_medida,
  precio_venta, costo_interno, impuesto, estado, observaciones`).
- Crea una cotización, agrega conceptos, guarda, y desde ahí registra pagos y
  seguimiento.

## Próximos pasos sugeridos (por prioridad)

1. **Vista de historial por placa** dedicada (hoy solo hay un `alert()` como
   marcador de posición) — mostrar línea de tiempo, pagos y notas juntas.
2. **PDF de cotización** (se puede generar en el navegador con una librería
   como `jsPDF`, o server-side con una Supabase Edge Function).
3. **Archivos adjuntos** usando Supabase Storage (bucket + política RLS).
4. **Reglas de cierre** (no permitir "cerrada" si hay saldo o faltan notas) —
   hoy el cambio de estado es libre; se puede validar en el frontend y/o con
   un trigger de base de datos.
5. Afinar permisos por rol en las políticas RLS (hoy recepción y admin tienen
   casi los mismos permisos de escritura, como pediste para el esqueleto).
6. Reemplazar el parser CSV casero por soporte de `.xlsx` real (por ejemplo
   con SheetJS) si el equipo prefiere subir Excel directo en vez de CSV.

## Estructura de archivos

```
taller-mvp/
├── index.html              → SPA completa (login + shell + todos los módulos)
├── assets/
│   ├── app.js               → lógica: auth, navegación, CRUD por módulo
│   ├── config.js             → credenciales de Supabase (edítalo tú)
│   └── styles.css            → estilos (paleta tomada de tu documento de especificación)
├── supabase/
│   └── schema.sql           → tablas, folio automático, RLS
└── README.md                 → este archivo
```
