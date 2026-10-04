-- ============================================================================
-- SpeedCenter · V12 Audit, Performance & Security Script
-- ============================================================================
-- 1. Indexing unindexed foreign keys and filter columns
-- 2. Role-Based Security Hardening (RLS functions and policies)
-- 3. Atomic quote header & detail save function (guardar_cotizacion_completa)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_vehiculos_created_by on public.vehiculos (created_by);
create index if not exists idx_cotizaciones_created_by on public.cotizaciones (created_by);
create index if not exists idx_cotizaciones_usuario_resp on public.cotizaciones (usuario_responsable);
create index if not exists idx_detalle_cotizacion_servicio on public.detalle_cotizacion (servicio_id);
create index if not exists idx_pagos_usuario on public.pagos (usuario_id);
create index if not exists idx_seguimientos_usuario on public.seguimientos (usuario_id);
create index if not exists idx_archivos_adjuntos_cotizacion on public.archivos_adjuntos (cotizacion_id);
create index if not exists idx_archivos_adjuntos_usuario on public.archivos_adjuntos (usuario_id);
create index if not exists idx_bitacora_usuario on public.bitacora (usuario_id);

-- ---------------------------------------------------------------------------
-- 2. HELPER SECURITY FUNCTIONS
-- ---------------------------------------------------------------------------
create or replace function public.es_staff()
returns boolean as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and p.rol in ('administrador', 'recepcion')
  );
$$ language sql security definer;

create or replace function public.es_admin()
returns boolean as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and p.rol = 'administrador'
  );
$$ language sql security definer;

-- ---------------------------------------------------------------------------
-- 3. ATOMIC TRANSACTION: guardar_cotizacion_completa
-- ---------------------------------------------------------------------------
create or replace function public.guardar_cotizacion_completa(
  p_cotizacion_id uuid,
  p_cliente_id uuid,
  p_vehiculo_id uuid,
  p_entrega_estimada date,
  p_kilometraje_visita int,
  p_observaciones text,
  p_estado_comercial text,
  p_estado_servicio text,
  p_estado_pago text,
  p_subtotal numeric,
  p_descuento_total numeric,
  p_total numeric,
  p_notas_finales text,
  p_cerrada_con_adeudo boolean,
  p_motivo_adeudo text,
  p_fecha_compromiso_pago date,
  p_conceptos jsonb
)
returns table (
  id uuid,
  folio text
) as $$
declare
  v_id uuid := p_cotizacion_id;
  v_folio text;
  v_item jsonb;
begin
  if not public.es_staff() then
    raise exception 'No tiene permisos para modificar o crear cotizaciones.';
  end if;

  if v_id is null then
    v_folio := public.siguiente_folio();
    insert into public.cotizaciones (
      folio, cliente_id, vehiculo_id, entrega_estimada, kilometraje_visita,
      observaciones, estado_comercial, estado_servicio, estado_pago,
      subtotal, descuento_total, total, notas_finales, cerrada_con_adeudo,
      motivo_adeudo, fecha_compromiso_pago, usuario_responsable, created_by
    ) values (
      v_folio, p_cliente_id, p_vehiculo_id, p_entrega_estimada, p_kilometraje_visita,
      p_observaciones, p_estado_comercial, p_estado_servicio, p_estado_pago,
      p_subtotal, p_descuento_total, p_total, p_notas_finales, p_cerrada_con_adeudo,
      p_motivo_adeudo, p_fecha_compromiso_pago, auth.uid(), auth.uid()
    ) returning cotizaciones.id into v_id;
  else
    select c.folio into v_folio from public.cotizaciones c where c.id = v_id;
    update public.cotizaciones set
      cliente_id = p_cliente_id,
      vehiculo_id = p_vehiculo_id,
      entrega_estimada = p_entrega_estimada,
      kilometraje_visita = p_kilometraje_visita,
      observaciones = p_observaciones,
      estado_comercial = p_estado_comercial,
      estado_servicio = p_estado_servicio,
      estado_pago = p_estado_pago,
      subtotal = p_subtotal,
      descuento_total = p_descuento_total,
      total = p_total,
      notas_finales = p_notas_finales,
      cerrada_con_adeudo = p_cerrada_con_adeudo,
      motivo_adeudo = p_motivo_adeudo,
      fecha_compromiso_pago = p_fecha_compromiso_pago,
      updated_at = now()
    where cotizaciones.id = v_id;
  end if;

  -- Atomic detail replacement
  delete from public.detalle_cotizacion where cotizacion_id = v_id;

  if p_conceptos is not null and jsonb_array_length(p_conceptos) > 0 then
    for v_item in select * from jsonb_array_elements(p_conceptos) loop
      insert into public.detalle_cotizacion (
        cotizacion_id, tipo, codigo, descripcion, cantidad,
        precio_unitario, descuento, importe
      ) values (
        v_id,
        coalesce(v_item->>'tipo', 'servicio'),
        v_item->>'codigo',
        coalesce(v_item->>'descripcion', ''),
        coalesce((v_item->>'cantidad')::numeric, 1),
        coalesce((v_item->>'precio_unitario')::numeric, 0),
        coalesce((v_item->>'descuento')::numeric, 0),
        coalesce((v_item->>'importe')::numeric, 0)
      );
    end loop;
  end if;

  return query select v_id as id, v_folio as folio;
end;
$$ language plpgsql security definer;
