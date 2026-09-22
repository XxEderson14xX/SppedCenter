-- ============================================================================
-- Sistema Taller Automotriz · MVP V1
-- Esquema de base de datos para Supabase (Postgres)
-- ============================================================================
-- Cómo usar:
-- 1. Crea un proyecto en https://supabase.com
-- 2. Ve a SQL Editor > New query
-- 3. Pega este archivo completo y ejecútalo (Run)
-- 4. Crea tu primer usuario administrador en Authentication > Users > Add user
--    y luego corre el UPDATE del final con su UUID.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Perfiles y roles (extiende auth.users, que ya trae Supabase)
-- ---------------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null default 'consulta' check (rol in ('administrador','recepcion','consulta')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil "consulta" cuando se registra un usuario nuevo
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, nombre_completo, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.email), 'consulta');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Clientes y vehículos
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  telefono text,
  correo text,
  rfc text,
  direccion text,
  observaciones text,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  placa text not null,
  vin text,
  marca text not null,
  modelo text not null,
  anio int,
  motor text,
  combustible text,
  color text,
  kilometraje_actual int,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vehiculos_placa on public.vehiculos (upper(regexp_replace(placa, '[\s-]', '', 'g')));
create index if not exists idx_vehiculos_cliente on public.vehiculos (cliente_id);

-- ---------------------------------------------------------------------------
-- 3. Catálogo de servicios
-- ---------------------------------------------------------------------------
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  categoria_id uuid references public.categorias(id),
  unidad_medida text not null default 'servicio',
  precio_venta numeric(12,2) not null default 0,
  costo_interno numeric(12,2),
  impuesto numeric(5,2) default 0,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Cotizaciones
-- ---------------------------------------------------------------------------
create sequence if not exists public.folio_cotizacion_seq start 1;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente_id uuid not null references public.clientes(id),
  vehiculo_id uuid not null references public.vehiculos(id),
  fecha date not null default current_date,
  vigencia_dias int default 15,
  usuario_responsable uuid references public.perfiles(id),
  entrega_estimada date,
  kilometraje_visita int,
  observaciones text,
  estado_comercial text not null default 'borrador'
    check (estado_comercial in ('borrador','enviada','pendiente_autorizacion','autorizada','rechazada','cancelada','cerrada')),
  estado_servicio text not null default 'sin_iniciar'
    check (estado_servicio in ('sin_iniciar','diagnostico','esperando_refacciones','en_proceso','terminado','vehiculo_entregado')),
  estado_pago text not null default 'sin_pago'
    check (estado_pago in ('sin_pago','anticipo_parcial','parcialmente_pagada','pagada','saldo_a_favor','pago_corregido')),
  subtotal numeric(12,2) not null default 0,
  descuento_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  anticipo_requerido numeric(12,2) default 0,
  cerrada_con_adeudo boolean not null default false,
  motivo_adeudo text,
  fecha_compromiso_pago date,
  notas_finales text,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cotizaciones_vehiculo on public.cotizaciones (vehiculo_id);
create index if not exists idx_cotizaciones_cliente on public.cotizaciones (cliente_id);

create or replace function public.siguiente_folio()
returns text as $$
  select 'COT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.folio_cotizacion_seq')::text, 6, '0');
$$ language sql;

-- ---------------------------------------------------------------------------
-- 5. Detalle de cotización (conceptos: servicio, mano de obra, refacción libre, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.detalle_cotizacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  tipo text not null check (tipo in ('servicio','mano_obra','consumible','refaccion_libre','descuento','nota')),
  servicio_id uuid references public.servicios(id),
  codigo text,
  descripcion text not null,
  numero_parte text,
  marca_proveedor text,
  compatibilidad text,
  cantidad numeric(10,2) not null default 1 check (cantidad > 0),
  costo_interno numeric(12,2),
  precio_unitario numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  importe numeric(12,2) not null default 0,
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists idx_detalle_cotizacion on public.detalle_cotizacion (cotizacion_id);

-- ---------------------------------------------------------------------------
-- 6. Pagos
-- ---------------------------------------------------------------------------
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  fecha date not null default current_date,
  importe numeric(12,2) not null check (importe > 0),
  metodo text not null check (metodo in ('efectivo','transferencia','tarjeta','deposito','otro')),
  referencia text,
  comprobante_url text,
  comentario text,
  estado text not null default 'valido' check (estado in ('valido','reversado')),
  reversado_de uuid references public.pagos(id),
  usuario_id uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_pagos_cotizacion on public.pagos (cotizacion_id);

-- ---------------------------------------------------------------------------
-- 7. Seguimiento (línea de tiempo)
-- ---------------------------------------------------------------------------
create table if not exists public.seguimientos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  tipo text not null default 'nota'
    check (tipo in ('cambio_estado','diagnostico','autorizacion','concepto_agregado','retraso','archivo','nota')),
  descripcion text not null,
  usuario_id uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_seguimientos_cotizacion on public.seguimientos (cotizacion_id);

-- ---------------------------------------------------------------------------
-- 8. Archivos adjuntos (referencia; el archivo en sí vive en Supabase Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.archivos_adjuntos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  tipo text check (tipo in ('recepcion','proceso','entrega','comprobante','otro')),
  nombre_archivo text not null,
  storage_path text not null,
  usuario_id uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. Importaciones masivas de catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.importaciones (
  id uuid primary key default gen_random_uuid(),
  archivo_nombre text not null,
  resumen jsonb,
  usuario_id uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. Bitácora (auditoría de acciones sensibles)
-- ---------------------------------------------------------------------------
create table if not exists public.bitacora (
  id uuid primary key default gen_random_uuid(),
  tabla_afectada text not null,
  registro_id uuid,
  accion text not null,
  valores_anteriores jsonb,
  valores_nuevos jsonb,
  usuario_id uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_bitacora_tabla on public.bitacora (tabla_afectada, registro_id);

-- ============================================================================
-- ROW LEVEL SECURITY (básico para el esqueleto — endurecer antes de producción)
-- ============================================================================
alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.vehiculos enable row level security;
alter table public.categorias enable row level security;
alter table public.servicios enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.detalle_cotizacion enable row level security;
alter table public.pagos enable row level security;
alter table public.seguimientos enable row level security;
alter table public.archivos_adjuntos enable row level security;
alter table public.importaciones enable row level security;
alter table public.bitacora enable row level security;

-- Lectura: cualquier usuario autenticado y activo puede leer todo
create policy "lectura_autenticados" on public.perfiles for select to authenticated using (true);
create policy "lectura_autenticados" on public.clientes for select to authenticated using (true);
create policy "lectura_autenticados" on public.vehiculos for select to authenticated using (true);
create policy "lectura_autenticados" on public.categorias for select to authenticated using (true);
create policy "lectura_autenticados" on public.servicios for select to authenticated using (true);
create policy "lectura_autenticados" on public.cotizaciones for select to authenticated using (true);
create policy "lectura_autenticados" on public.detalle_cotizacion for select to authenticated using (true);
create policy "lectura_autenticados" on public.pagos for select to authenticated using (true);
create policy "lectura_autenticados" on public.seguimientos for select to authenticated using (true);
create policy "lectura_autenticados" on public.archivos_adjuntos for select to authenticated using (true);
create policy "lectura_autenticados" on public.importaciones for select to authenticated using (true);
create policy "lectura_autenticados" on public.bitacora for select to authenticated using (true);

-- Escritura: cualquier usuario autenticado puede crear/editar (recepción + admin)
-- MVP: se restringe solo lo mínimo (borrar catálogo/usuarios es solo admin).
create policy "escritura_autenticados" on public.clientes for insert to authenticated with check (true);
create policy "actualizar_autenticados" on public.clientes for update to authenticated using (true);

create policy "escritura_autenticados" on public.vehiculos for insert to authenticated with check (true);
create policy "actualizar_autenticados" on public.vehiculos for update to authenticated using (true);

create policy "escritura_autenticados" on public.cotizaciones for insert to authenticated with check (true);
create policy "actualizar_autenticados" on public.cotizaciones for update to authenticated using (true);

create policy "escritura_autenticados" on public.detalle_cotizacion for insert to authenticated with check (true);
create policy "actualizar_autenticados" on public.detalle_cotizacion for update to authenticated using (true);
create policy "borrar_autenticados" on public.detalle_cotizacion for delete to authenticated using (true);

create policy "escritura_autenticados" on public.pagos for insert to authenticated with check (true);
create policy "actualizar_autenticados" on public.pagos for update to authenticated using (true);

create policy "escritura_autenticados" on public.seguimientos for insert to authenticated with check (true);

create policy "escritura_autenticados" on public.archivos_adjuntos for insert to authenticated with check (true);

create policy "escritura_autenticados" on public.bitacora for insert to authenticated with check (true);

-- Catálogo, categorías e importaciones: solo administrador escribe
create policy "admin_escribe_servicios" on public.servicios for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
create policy "admin_actualiza_servicios" on public.servicios for update to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

create policy "admin_escribe_categorias" on public.categorias for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

create policy "admin_escribe_importaciones" on public.importaciones for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

create policy "admin_actualiza_perfiles" on public.perfiles for update to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador') or auth.uid() = id);

-- ============================================================================
-- Datos semilla mínimos (opcional)
-- ============================================================================
insert into public.categorias (nombre) values
  ('Servicio general'), ('Mano de obra'), ('Consumibles'), ('Paquete')
on conflict (nombre) do nothing;

-- Después de crear tu primer usuario en Authentication > Users, súbelo a administrador:
-- update public.perfiles set rol = 'administrador' where id = 'PEGA-AQUI-EL-UUID-DEL-USUARIO';
