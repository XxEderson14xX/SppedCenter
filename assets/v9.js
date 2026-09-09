// ============================================================================
// Sistema Taller Automotriz · assets/v9.js · V11.2
// OT robusta (guardar/finalizar sin cuelgues) + Orden estilo SPEED CENTER
// + Herramienta especial (identificador + historial)
// ============================================================================
(() => {
const $ = id => document.getElementById(id);
let otId = null;
let otEnProceso = false;   // candado anti-doble-clic / anti-cuelgue

const EMPRESA_OT = {
  nombre: "SPEED CENTER",
  direccion: "Cda. de Uniroyal 4, La Michoacana, 52166 San Jorge Pueblo Nuevo, México.",
  telefono: "Teléfono 722 687 6487",
  logo: "assets/logo.png"
};

function admin(){ return estado?.perfil?.rol === 'administrador'; }
function staff(){ return ['administrador','recepcion'].includes(estado?.perfil?.rol); }
function esConsultaOT(){ return estado?.perfil?.rol === 'consulta'; }
function aplicarPermisosOT(){
  const soloLectura = esConsultaOT();
  const tecnico = $('v9-ot-tecnico');
  const obs = $('v9-ot-observaciones');
  const guardar = $('v9-guardar-ot');
  const finalizar = $('v9-finalizar-ot');
  const todos = $('v9-seleccionar-todos');
  if (soloLectura) {
    if (tecnico) tecnico.disabled = true;
    if (obs) obs.disabled = true;
    obtenerChecksOT().forEach(x => x.disabled = true);
    if (todos) {
      todos.disabled = true;
      const c = todos.closest('.v9-seleccionar-todos-contenedor');
      if (c) c.style.display = 'none';
    }
    if (guardar) guardar.style.display = 'none';
    if (finalizar) finalizar.style.display = 'none';
    // "Imprimir" y el botón de cerrar el modal se dejan activos (solo lectura).
  }
}
function hoy(){ return new Date().toISOString().slice(0,10); }
function texto(v, fallback='—'){ return v === null || v === undefined || v === '' ? fallback : String(v); }
function fechaHora(v){ if(!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? texto(v) : d.toLocaleString('es-MX'); }
function fechaCorta(v){ if(!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? texto(v) : d.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }); }
function escapar(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function mostrarErrorV11(id, error, fallback){ const n=$(id); const msg=error?.message || fallback; console.error(msg,error||''); if(n) n.innerHTML=`<div style="color:#c0392b;margin-top:8px">${escapar(msg)}</div>`; }
function limpiarMensajeV11(id){ const n=$(id); if(n) n.innerHTML=''; }

function generarCodigoHerramientaV11(){
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'HER-' + crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();
  }
  return 'HER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,7).toUpperCase();
}

function aplicarPermisos(){
  const r=estado?.perfil?.rol;
  document.querySelectorAll('[data-admin-only]').forEach(x=>x.style.display=r==='administrador'?'':'none');
  if(r==='tecnico'){
    document.querySelectorAll('.nav-item').forEach(x=>{if(!['inicio','ordenes','herramientas'].includes(x.dataset.modulo))x.style.display='none';});
  }
}
function activarModulos(){
  document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>{
    const f={ordenes:cargarOT,carga:cargarCarga,ingresos:cargarIngresos,herramientas:cargarHerramientas}[n.dataset.modulo];
    if(f)setTimeout(f,0);
  }));
}
async function dashboard(){
  const {data}=await sb.rpc('dashboard_v9');
  if(!data)return;
  if($('dash-ot-abiertas'))$('dash-ot-abiertas').textContent=data.ot_abiertas||0;
  if($('dash-trabajos-pendientes'))$('dash-trabajos-pendientes').textContent=data.trabajos_pendientes||0;
  if($('dash-ot-terminadas'))$('dash-ot-terminadas').textContent=data.ot_terminadas_hoy||0;
  if($('dash-ingresos-hoy'))$('dash-ingresos-hoy').textContent='$'+money(data.ingresos_hoy||0);
  if($('dash-avance-ordenes'))$('dash-avance-ordenes').innerHTML=(data.ordenes||[]).map(o=>`<div><strong>${escapar(o.folio)}</strong> · ${escapar(o.placa)} · ${o.realizados}/${o.total}<div class="v9-progreso"><span style="width:${o.total?o.realizados/o.total*100:0}%"></span></div></div>`).join('')||'<small>Sin órdenes abiertas.</small>';
  if($('dash-herramientas'))$('dash-herramientas').textContent=`Disponibles ${data.herramientas_disponibles||0} · Prestadas ${data.herramientas_prestadas||0} · Fuera de servicio ${data.herramientas_fuera||0}`;
  if($('dash-pagos'))$('dash-pagos').innerHTML=(data.ultimos_pagos||[]).map(p=>`<div>${escapar(p.folio)} · $${money(p.importe)} · ${escapar(p.metodo)}</div>`).join('')||'<small>Sin pagos hoy.</small>';
}

function calcDesc(){
  const tipo=document.querySelector('input[name="v9-desc-tipo"]:checked')?.value||'ninguno';
  const v=Number($('v9-desc-valor')?.value||0);
  const sub=(estado.conceptosEnEdicion||[]).reduce((s,c)=>s+(Number(c.cantidad)||0)*(Number(c.precio_unitario)||0),0);
  let d=tipo==='porcentaje'?Math.min(sub,sub*Math.min(v,100)/100):tipo==='monto'?Math.min(sub,v):0;
  (estado.conceptosEnEdicion||[]).forEach(c=>c.descuento=0);
  if(estado.conceptosEnEdicion?.[0])estado.conceptosEnEdicion[0].descuento=d;
  if($('v9-desc-texto'))$('v9-desc-texto').textContent=tipo==='porcentaje'?`${v}%`:tipo==='monto'?`$${money(v)}`:'Sin descuento';
  if(typeof recalcularTotales==='function')recalcularTotales();
}
document.querySelectorAll('input[name="v9-desc-tipo"]').forEach(r=>r.addEventListener('change',()=>{if($('v9-desc-valor'))$('v9-desc-valor').disabled=r.checked&&r.value==='ninguno';calcDesc();}));
$('v9-desc-valor')?.addEventListener('input',calcDesc);
const renderOriginal=window.renderConceptos;
if(renderOriginal){window.renderConceptos=function(){renderOriginal();document.querySelectorAll('#cuerpo-conceptos [data-campo="descuento"]').forEach(i=>{const td=i.closest('td');if(td)td.style.display='none';});bloquearCot();};}
function bloquearCot(){
  const aut=$('cotizacion-estado-comercial')?.value==='autorizada';
  if($('v9-adicionales'))$('v9-adicionales').style.display=aut?'block':'none';
  if($('btn-v9-ot'))$('btn-v9-ot').style.display=aut?'inline-block':'none';
  if(aut&&!admin()){
    document.querySelectorAll('#cuerpo-conceptos [data-campo]').forEach(i=>{i.disabled=true;i.classList.add('v9-lock');});
    document.querySelectorAll('#cuerpo-conceptos [data-quitar]').forEach(b=>b.style.display='none');
    if($('btn-agregar-concepto'))$('btn-agregar-concepto').style.display='none';
    if($('btn-cat-agregar'))$('btn-cat-agregar').style.display='none';
    document.querySelectorAll('.v9-descuento input').forEach(i=>i.disabled=true);
    const e=$('cotizacion-estado-comercial'); if(e)[...e.options].forEach(o=>o.disabled=!['autorizada','cerrada'].includes(o.value));
  }else if(aut&&admin()){
    const e=$('cotizacion-estado-comercial'); if(e)[...e.options].forEach(o=>o.disabled=!['autorizada','cerrada','cancelada'].includes(o.value));
  }
}
$('cotizacion-estado-comercial')?.addEventListener('change',()=>setTimeout(bloquearCot,0));

async function adicionales(){
  const id=$('cotizacion-id')?.value;if(!id)return;
  const {data}=await sb.from('cotizacion_adicionales').select('*').eq('cotizacion_id',id).order('created_at');
  if(!$('v9-lista-adicionales'))return;
  $('v9-lista-adicionales').innerHTML=(data||[]).map(a=>`<div class="v9-adicional"><b>${escapar(a.descripcion)}</b> · ${a.cantidad} × $${money(a.precio_unitario)} <span class="badge ${a.estado==='autorizado'?'verde':a.estado==='no_autorizado'?'rojo':'naranja'}">${escapar(a.estado)}</span>${a.observacion?`<div>${escapar(a.observacion)}</div>`:''}${a.estado==='pendiente'&&staff()?`<button class="btn pequeno" data-a="${a.id}">Autorizar</button> <button class="btn secundario pequeno" data-n="${a.id}">No autorizar</button>`:''}</div>`).join('')||'<small>Sin adicionales.</small>';
  document.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{await sb.rpc('resolver_adicional',{p_adicional_id:b.dataset.a,p_estado:'autorizado'});adicionales();});
  document.querySelectorAll('[data-n]').forEach(b=>b.onclick=async()=>{await sb.rpc('resolver_adicional',{p_adicional_id:b.dataset.n,p_estado:'no_autorizado'});adicionales();});
}
$('btn-v9-adicional')?.addEventListener('click',()=>abrirModal('modal-v9-adicional'));
$('v9-guardar-adicional')?.addEventListener('click',async()=>{
  const {error}=await sb.from('cotizacion_adicionales').insert({cotizacion_id:$('cotizacion-id').value,descripcion:$('v9-ad-desc').value.trim(),cantidad:Number($('v9-ad-cant').value||1),precio_unitario:Number($('v9-ad-precio').value||0),observacion:$('v9-ad-obs').value.trim()||null,created_by:estado.usuario.id});
  if(!error){cerrarModal('modal-v9-adicional');adicionales();}
});

async function cargarOT(){let q=sb.rpc('ordenes_trabajo_listar');const {data}=await q;let l=data||[];if(estado.perfil?.rol==='tecnico')l=l.filter(x=>x.tecnico_id===estado.usuario.id);window.v9OT=l;renderOT();}
function renderOT(){const txt=($('buscar-orden')?.value||'').toLowerCase(),f=$('filtro-orden')?.value||'';let l=window.v9OT||[];if(txt)l=l.filter(x=>[x.folio,x.cotizacion_folio,x.placa].some(v=>(v||'').toLowerCase().includes(txt)));if(f)l=l.filter(x=>x.estado===f);if($('tabla-ordenes'))$('tabla-ordenes').innerHTML=l.map(x=>`<tr><td>${escapar(x.folio)}</td><td>${escapar(x.cotizacion_folio)}</td><td>${escapar(x.placa)} · ${escapar(x.vehiculo)}</td><td>${escapar(x.tecnico||'Sin asignar')}</td><td>${x.realizados}/${x.total}</td><td>${escapar(x.estado)}</td><td><button class="btn secundario pequeno" data-ot="${x.id}">Abrir</button></td></tr>`).join('');document.querySelectorAll('[data-ot]').forEach(b=>b.onclick=()=>abrirOT(b.dataset.ot));}
$('buscar-orden')?.addEventListener('input',renderOT);$('filtro-orden')?.addEventListener('change',renderOT);
$('btn-v9-ot')?.addEventListener('click',async()=>{const {data,error}=await sb.rpc('generar_orden_trabajo',{p_cotizacion_id:$('cotizacion-id').value});if(!error)abrirOT(data);});
document.addEventListener('click',ev=>{const btn=ev.target.closest('[data-cerrar-modal]');if(!btn)return;const id=btn.dataset.cerrarModal;if(id&&document.getElementById(id))cerrarModal(id);});

function obtenerChecksOT(){return [...document.querySelectorAll('[data-check]')];}
function obtenerAvanceOT(){const checks=obtenerChecksOT();const total=checks.length;const realizados=checks.filter(x=>x.checked).length;return{total,realizados,pendientes:total-realizados,porcentaje:total?Math.round(realizados/total*100):0};}
function actualizarAvanceOT(){const a=obtenerAvanceOT(),contador=$('v9-ot-contador'),porcentaje=$('v9-ot-porcentaje'),barra=$('v9-ot-barra'),todos=$('v9-seleccionar-todos'),finalizar=$('v9-finalizar-ot'),ayuda=$('v9-finalizar-ayuda');if(contador)contador.textContent=`${a.realizados} de ${a.total} realizados`;if(porcentaje)porcentaje.textContent=`${a.porcentaje}%`;if(barra)barra.style.width=`${a.porcentaje}%`;if(todos){todos.indeterminate=a.realizados>0&&a.realizados<a.total;todos.checked=a.total>0&&a.realizados===a.total;}if(finalizar&&!window.v9OTTerminada){const completo=a.total>0&&a.realizados===a.total;finalizar.style.opacity=completo?'1':'0.6';if(ayuda){ayuda.textContent=completo?'Todos los trabajos estan realizados. La OT puede finalizarse.':a.total?`Faltan ${a.pendientes} trabajos por completar.`:'La orden no contiene trabajos.';ayuda.style.color=completo?'#18794e':'#9a6700';}}}
function c(){const t=$('v9-seleccionar-todos');if(!t)return;t.onchange=()=>{if(window.v9OTTerminada)return;const val=t.checked;obtenerChecksOT().forEach(c=>{c.checked=val;});actualizarAvanceOT();};}
function configurarChecksOT(){obtenerChecksOT().forEach(c=>c.onchange=()=>{if(!window.v9OTTerminada)actualizarAvanceOT();});}
function aplicarModoOT(terminada){window.v9OTTerminada=terminada;const tecnico=$('v9-ot-tecnico'),obs=$('v9-ot-observaciones'),guardar=$('v9-guardar-ot'),finalizar=$('v9-finalizar-ot'),todos=$('v9-seleccionar-todos'),visual=$('v9-ot-estado-visual');if(tecnico)tecnico.disabled=terminada;if(obs)obs.disabled=terminada;obtenerChecksOT().forEach(x=>x.disabled=terminada);if(todos){todos.disabled=terminada;const c=todos.closest('.v9-seleccionar-todos-contenedor');if(c)c.style.display=terminada?'none':'';}if(guardar)guardar.style.display=terminada?'none':'';if(finalizar)finalizar.style.display=terminada?'none':'';if(visual){visual.textContent=terminada?'TERMINADA':'ABIERTA';visual.className=`v9-ot-estado ${terminada?'v9-ot-estado-terminada':'v9-ot-estado-abierta'}`;}actualizarAvanceOT();}
async function abrirOT(id){
  otId=id;
  const [{data:o,error:errorOrden},{data:d,error:errorDetalle},{data:t,error:errorTecnicos}]=await Promise.all([
    sb.from('ordenes_trabajo').select('*,cotizaciones(folio),vehiculos(placa,marca,modelo)').eq('id',id).single(),
    sb.from('orden_trabajo_detalle').select('*').eq('orden_trabajo_id',id).order('created_at'),
    sb.from('perfiles').select('id,nombre_completo').eq('rol','tecnico').eq('activo',true)
  ]);
  if(errorOrden){console.error('Error al cargar OT:',errorOrden);alert('No fue posible cargar la orden de trabajo.');return;}
  if(errorDetalle){console.error('Error al cargar detalle OT:',errorDetalle);alert('No fue posible cargar los trabajos de la orden.');return;}
  if(errorTecnicos)console.error('Error al cargar tecnicos:',errorTecnicos);
  $('v9-ot-titulo').textContent=`Orden ${o.folio}`;
  $('v9-ot-resumen').innerHTML=`<div class="v9-ot-resumen-grid"><div><small>Cotizacion</small><strong>${escapar(o.cotizaciones?.folio||'—')}</strong></div><div><small>Vehiculo</small><strong>${escapar(o.vehiculos?.placa||'—')} · ${escapar(o.vehiculos?.marca||'')} ${escapar(o.vehiculos?.modelo||'')}</strong></div><div><small>Estado</small><strong id="v9-ot-estado-visual" class="v9-ot-estado">${o.estado==='terminada'?'TERMINADA':'ABIERTA'}</strong></div></div>`;
  $('v9-ot-tecnico').innerHTML='<option value="">Sin asignar</option>'+(t||[]).map(x=>`<option value="${x.id}" ${x.id===o.tecnico_id?'selected':''}>${escapar(x.nombre_completo)}</option>`).join('');
  $('v9-ot-asignacion').style.display=estado.perfil?.rol==='tecnico'?'none':'block';
  $('v9-ot-trabajos').innerHTML=`<div class="v9-avance-cabecera"><div><strong>Avance del servicio</strong><div id="v9-ot-contador" class="v9-avance-contador">0 de 0 realizados</div></div><div id="v9-ot-porcentaje" class="v9-avance-porcentaje">0%</div></div><div class="v9-progreso v9-progreso-ot"><span id="v9-ot-barra" style="width:0%"></span></div><label class="v9-seleccionar-todos-contenedor"><input id="v9-seleccionar-todos" type="checkbox"><strong>Seleccionar todos los trabajos</strong></label><div class="v9-lista-trabajos">${(d||[]).map(x=>`<label class="v9-check"><input data-check="${x.id}" type="checkbox" ${x.realizado?'checked':''}><span>${escapar(x.descripcion)}</span></label>`).join('')}</div><div id="v9-finalizar-ayuda" class="v9-finalizar-ayuda"></div>`;
  $('v9-ot-observaciones').value=o.observaciones||'';
  configurarSeleccionTodosOT();configurarChecksOT();aplicarModoOT(o.estado==='terminada');aplicarPermisosOT();abrirModal('modal-v9-orden');
}

// ---- Guardado robusto (una sola función, con candado y finally) ------------
async function guardarAvanceOT({finalizar=false} = {}) {
  if (!otId) return;
  if (window.v9OTTerminada) { alert('Esta orden ya está terminada y no puede modificarse.'); return; }
  if (otEnProceso) return;            // evita doble clic / recursión
  otEnProceso = true;

  const btnGuardar = $('v9-guardar-ot');
  const btnFinalizar = $('v9-finalizar-ot');
  const txtG = btnGuardar ? btnGuardar.textContent : '';
  const txtF = btnFinalizar ? btnFinalizar.textContent : '';

  if (btnGuardar) { btnGuardar.disabled = true; }
  if (btnFinalizar) { btnFinalizar.disabled = true; }
  if (finalizar && btnFinalizar) btnFinalizar.textContent = 'Finalizando...';
  else if (btnGuardar) btnGuardar.textContent = 'Guardando...';

  try {
    // Estado REAL de las casillas en este instante
    const checks = obtenerChecksOT().map(x => ({ id: x.dataset.check, realizado: !!x.checked }));

    // 1) Siempre guarda el avance actual
    const { error: errG } = await sb.rpc('guardar_avance_orden', {
      p_orden_id: otId,
      p_checks: checks,
      p_observaciones: $('v9-ot-observaciones')?.value || '',
      p_tecnico_id: $('v9-ot-tecnico')?.value || null
    });
    if (errG) { console.error('Error al guardar avance:', errG); alert(errG.message || 'No fue posible guardar el avance.'); return; }

    // 2) Si NO es finalizar, terminamos aquí
    if (!finalizar) {
      await cargarOT();
      cerrarModal('modal-v9-orden');
      return;
    }

    // 3) Finalizar: valida con el estado real (ya guardado)
    const a = obtenerAvanceOT();
    if (!a.total) { alert('La orden no contiene trabajos para finalizar.'); return; }
    if (a.pendientes > 0) {
      alert(`No puedes finalizar esta orden.\n\nAvance: ${a.realizados} de ${a.total}.\nQuedan ${a.pendientes} trabajos pendientes.`);
      return;
    }
    if (!confirm(`Finalizar orden de trabajo\n\n${a.realizados} de ${a.total} trabajos están realizados.\n\nLa orden quedará marcada como terminada.\n\n¿Deseas continuar?`)) return;

    const { error: errF } = await sb.rpc('finalizar_orden', { p_orden_id: otId });
    if (errF) { console.error('Error al finalizar OT:', errF); alert(errF.message || 'No fue posible finalizar la orden.'); return; }

    await cargarOT();
    cerrarModal('modal-v9-orden');

  } catch (e) {
    console.error('Error inesperado en OT:', e);
    alert(e?.message || 'Ocurrió un error inesperado.');
  } finally {
    // Pase lo que pase, se re-habilitan los botones (nunca se congela)
    otEnProceso = false;
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = txtG || 'Guardar avance'; }
    if (btnFinalizar) { btnFinalizar.disabled = false; btnFinalizar.textContent = txtF || 'Finalizar'; }
  }
}

$('v9-guardar-ot')?.addEventListener('click', () => guardarAvanceOT({ finalizar: false }));
$('v9-finalizar-ot')?.addEventListener('click', () => guardarAvanceOT({ finalizar: true }));

// ============================================================================
// IMPRIMIR ORDEN DE TRABAJO · estilo SPEED CENTER
// ============================================================================
$('v9-imprimir-ot')?.addEventListener('click', async () => {
  if (!otId) { alert('Abre una orden primero.'); return; }
  const { data: o, error } = await sb
    .from('ordenes_trabajo')
    .select('*, cotizaciones(folio, entrega_estimada, kilometraje_visita, cliente_id), vehiculos(placa, marca, modelo, anio, vin)')
    .eq('id', otId).single();
  if (error || !o) { alert('No fue posible cargar la orden para imprimir.'); return; }

  const cliId = o.cotizaciones?.cliente_id;
  const [cliRes, tecRes] = await Promise.all([
    cliId ? sb.from('clientes').select('nombre_completo, telefono').eq('id', cliId).single() : Promise.resolve({ data: null }),
    o.tecnico_id ? sb.from('perfiles').select('nombre_completo').eq('id', o.tecnico_id).single() : Promise.resolve({ data: null })
  ]);
  const cliente = cliRes.data, tecnico = tecRes.data;

  const a = obtenerAvanceOT();
  const trabajos = obtenerChecksOT().map(x => ({ done: x.checked, txt: (x.parentElement?.innerText || '').trim() }));
  const observaciones = $('v9-ot-observaciones')?.value || '';
  const v = o.vehiculos || {};
  const autoTxt = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ');
  const logoURL = new URL(EMPRESA_OT.logo, location.href).href;
  const fechaOrden = fechaCorta(o.created_at || o.fecha);
  const fechaEntrega = fechaCorta(o.cotizaciones?.entrega_estimada);
  const km = o.cotizaciones?.kilometraje_visita;
  const estadoTxt = o.estado === 'terminada' ? 'TERMINADA' : 'ABIERTA';
  const estadoColor = o.estado === 'terminada' ? '#18794e' : '#d98c00';

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`
<html><head><meta charset="UTF-8"><title>${escapar(o.folio || 'Orden')}</title>
<style>
  *{box-sizing:border-box;} body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:28px 34px;}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c81414;padding-bottom:10px;}
  .top img{max-height:52px;} .emp{text-align:right;} .emp .n{color:#c81414;font-weight:bold;font-size:16px;} .emp .d{font-size:9px;color:#333;}
  .titulo{margin:14px 0 4px;text-align:center;} .titulo h1{margin:0;font-size:18px;letter-spacing:1px;}
  .folio{text-align:center;color:#c81414;font-weight:bold;font-size:15px;margin-bottom:12px;}
  table.info{width:100%;border-collapse:collapse;margin-bottom:14px;} table.info td{border:1px solid #bbb;padding:5px 8px;font-size:10.5px;}
  table.info td.lbl{background:#4d4d4d;color:#fff;font-weight:bold;width:120px;text-transform:uppercase;font-size:9px;}
  .badge{display:inline-block;padding:2px 10px;border-radius:10px;color:#fff;font-weight:bold;font-size:10px;}
  h2{font-size:13px;border-bottom:1px solid #ccc;padding-bottom:4px;margin:16px 0 8px;}
  .avance-box{display:flex;align-items:center;gap:10px;margin-bottom:8px;} .barra{flex:1;height:12px;background:#eee;border-radius:6px;overflow:hidden;} .barra span{display:block;height:100%;background:#1b7884;}
  .avance-txt{font-size:11px;font-weight:bold;} .trabajo{padding:6px 2px;border-bottom:1px dashed #ddd;font-size:11px;} .obs{font-size:11px;white-space:pre-wrap;}
  .firmas{display:flex;justify-content:space-between;margin-top:50px;} .firma{width:44%;text-align:center;} .firma .line{border-top:1px solid #333;margin-bottom:4px;} .firma small{font-size:10px;color:#555;}
  .pie{margin-top:24px;font-size:8.5px;color:#777;text-align:center;border-top:1px solid #ddd;padding-top:8px;}
  @media print{body{padding:14px 20px;}}
</style></head><body>
  <div class="top"><img src="${logoURL}" onerror="this.style.display='none'">
    <div class="emp"><div class="n">${escapar(EMPRESA_OT.nombre)}</div><div class="d">${escapar(EMPRESA_OT.direccion)}</div><div class="d">${escapar(EMPRESA_OT.telefono)}</div></div>
  </div>
  <div class="titulo"><h1>ORDEN DE TRABAJO</h1></div>
  <div class="folio">${escapar(o.folio || '')}</div>
  <table class="info">
    <tr><td class="lbl">Fecha de la orden</td><td>${escapar(fechaOrden)}</td><td class="lbl">Estado</td><td><span class="badge" style="background:${estadoColor}">${estadoTxt}</span></td></tr>
    <tr><td class="lbl">Cliente</td><td>${escapar(texto(cliente?.nombre_completo).toUpperCase())}</td><td class="lbl">Teléfono</td><td>${escapar(texto(cliente?.telefono))}</td></tr>
    <tr><td class="lbl">Vehículo</td><td>${escapar(texto(autoTxt).toUpperCase())}</td><td class="lbl">Placas</td><td>${escapar(texto(v.placa).toUpperCase())}</td></tr>
    <tr><td class="lbl">VIN</td><td>${escapar(texto(v.vin))}</td><td class="lbl">Kilometraje</td><td>${km!=null?escapar(String(km)):'—'}</td></tr>
    <tr><td class="lbl">Técnico asignado</td><td>${escapar(texto(tecnico?.nombre_completo).toUpperCase())}</td><td class="lbl">Entrega estimada</td><td>${escapar(fechaEntrega)}</td></tr>
    <tr><td class="lbl">Cotización ref.</td><td colspan="3">${escapar(texto(o.cotizaciones?.folio))}</td></tr>
  </table>
  <h2>Trabajos autorizados</h2>
  <div class="avance-box"><div class="barra"><span style="width:${a.porcentaje}%"></span></div><div class="avance-txt">${a.realizados} de ${a.total} (${a.porcentaje}%)</div></div>
  ${trabajos.length ? trabajos.map(t => `<div class="trabajo">${t.done ? '☑' : '☐'} ${escapar(t.txt)}</div>`).join('') : '<div class="trabajo">Sin trabajos registrados.</div>'}
  <h2>Refacciones / caja</h2><div class="obs">Las piezas retiradas deberán colocarse en la caja correspondiente al vehículo.</div>
  <h2>Observaciones</h2><div class="obs">${escapar(observaciones || 'Sin observaciones.')}</div>
  <div class="firmas"><div class="firma"><div class="line"></div><small>Firma del cliente</small></div><div class="firma"><div class="line"></div><small>Firma del técnico</small></div></div>
  <div class="pie">Documento generado el ${escapar(fechaCorta(new Date().toISOString()))} · ${escapar(EMPRESA_OT.nombre)}</div>
</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
});

// carga operativa (sin ranking)
async function cargarCarga(){if(!admin())return;const mes=$('carga-mes').value||new Date().toISOString().slice(0,7);$('carga-mes').value=mes;const {data}=await sb.rpc('carga_trabajo_operativa',{p_mes:mes});$('carga-tecnicos').innerHTML=(data||[]).map(x=>`<div class="panel"><h3>${escapar(x.tecnico)}</h3><p>Órdenes abiertas: <b>${x.ordenes_abiertas}</b> · Trabajos pendientes: <b>${x.trabajos_pendientes}</b> · Órdenes atendidas en el mes: <b>${x.ordenes_mes}</b></p></div>`).join('')||'<div class="panel">Sin datos.</div>';}
$('carga-mes')?.addEventListener('change',cargarCarga);

// ingresos
async function cargarIngresos(){const f=$('ingresos-fecha').value||hoy();$('ingresos-fecha').value=f;const {data}=await sb.rpc('ingresos_por_dia',{p_fecha:f});let l=data||[],m=$('ingresos-metodo').value;if(m)l=l.filter(x=>x.metodo===m);const sum=met=>l.filter(x=>x.estado==='valido'&&(!met||x.metodo===met)).reduce((s,x)=>s+Number(x.importe),0);$('ing-total').textContent='$'+money(sum());$('ing-efectivo').textContent='$'+money(sum('efectivo'));$('ing-transferencia').textContent='$'+money(sum('transferencia'));$('ing-tarjeta').textContent='$'+money(sum('tarjeta'));$('tabla-ingresos').innerHTML=l.map(x=>`<tr><td>${new Date(x.fecha_hora).toLocaleTimeString('es-MX')}</td><td>${escapar(x.folio)}</td><td>${escapar(x.cliente)} · ${escapar(x.placa)}</td><td>${escapar(x.metodo)}</td><td>${escapar(x.referencia||'—')}</td><td>$${money(x.importe)}</td><td>${escapar(x.estado)}</td></tr>`).join('');}
$('ingresos-fecha')?.addEventListener('change',cargarIngresos);$('ingresos-metodo')?.addEventListener('change',cargarIngresos);

// ============================================================================
// HERRAMIENTA ESPECIAL · V11.1
// ============================================================================
function valorHerr(x,...nombres){for(const n of nombres){if(Object.prototype.hasOwnProperty.call(x||{},n))return x[n];}return null;}
function datosHerrV11(x){return{id:valorHerr(x,'id'),codigo:valorHerr(x,'codigo','identificador'),nombre:valorHerr(x,'nombre'),serie:valorHerr(x,'numero_serie','serie'),marca:valorHerr(x,'marca'),modelo:valorHerr(x,'modelo'),ubicacion:valorHerr(x,'ubicacion'),estado:valorHerr(x,'estado'),asignada:valorHerr(x,'asignada_a','tecnico'),desde:valorHerr(x,'desde','prestado_desde'),observaciones:valorHerr(x,'observaciones')};}
async function cargarHerramientas(){
  const tabla=$('tabla-herramientas');if(!tabla)return;
  tabla.innerHTML='<tr><td colspan="9" class="vacio-tabla">Cargando…</td></tr>';
  const {data,error}=await sb.rpc('herramientas_listar');
  if(error){console.error('Error al cargar herramientas:',error);tabla.innerHTML=`<tr><td colspan="9" class="vacio-tabla">${escapar(error.message||'No fue posible cargar las herramientas.')}</td></tr>`;return;}
  window.v9Herr=data||[];renderHerr();
}
function renderHerr(){
  const tabla=$('tabla-herramientas');if(!tabla)return;
  const t=($('buscar-herramienta')?.value||'').trim().toLowerCase();
  const f=$('filtro-herramienta')?.value||'';
  let l=(window.v9Herr||[]).map(x=>({raw:x,v:datosHerrV11(x)}));
  if(t)l=l.filter(({v})=>[v.codigo,v.nombre,v.serie,v.marca,v.modelo,v.ubicacion].some(z=>String(z||'').toLowerCase().includes(t)));
  if(f)l=l.filter(({v})=>v.estado===f);
  if(!l.length){tabla.innerHTML='<tr><td colspan="9" class="vacio-tabla">Sin herramientas para mostrar.</td></tr>';return;}
  tabla.innerHTML=l.map(({v})=>`<tr><td><strong>${escapar(texto(v.codigo))}</strong></td><td>${escapar(texto(v.nombre))}</td><td>${escapar(texto(v.serie))}</td><td>${escapar([v.marca,v.modelo].filter(Boolean).join(' / ')||'—')}</td><td>${escapar(texto(v.ubicacion))}</td><td><span class="badge ${v.estado==='disponible'?'verde':v.estado==='prestada'?'naranja':'gris'}">${escapar(texto(v.estado))}</span></td><td>${escapar(texto(v.asignada))}</td><td>${escapar(fechaHora(v.desde))}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap">${staff()?`<button class="btn secundario pequeno" data-herr-editar="${v.id}">Editar</button>`:''}${v.estado==='disponible'&&staff()?`<button class="btn pequeno" data-prestar="${v.id}">Prestar</button>`:''}${v.estado==='prestada'&&staff()?`<button class="btn secundario pequeno" data-devolver="${v.id}">Devolver</button>`:''}<button class="btn secundario pequeno" data-historial-herr="${v.id}">Historial</button></div></td></tr>`).join('');
  document.querySelectorAll('[data-herr-editar]').forEach(b=>b.onclick=()=>abrirHerramientaEditar(b.dataset.herrEditar));
  document.querySelectorAll('[data-prestar]').forEach(b=>b.onclick=()=>prestamo(b.dataset.prestar));
  document.querySelectorAll('[data-devolver]').forEach(b=>b.onclick=()=>abrirDevolucion(b.dataset.devolver));
  document.querySelectorAll('[data-historial-herr]').forEach(b=>b.onclick=()=>abrirHistorialHerramienta(b.dataset.historialHerr));
}
$('buscar-herramienta')?.addEventListener('input',renderHerr);
$('filtro-herramienta')?.addEventListener('change',renderHerr);
function limpiarFormularioHerramienta(){
  [['v11-herr-id',''],['v9-herr-nombre',''],['v11-herr-serie',''],['v11-herr-marca',''],['v11-herr-modelo',''],['v11-herr-ubicacion',''],['v9-herr-obs','']].forEach(([id,v])=>{if($(id))$(id).value=v;});
  if($('v9-herr-codigo')){ $('v9-herr-codigo').value = generarCodigoHerramientaV11(); }
  if($('v11-herr-titulo'))$('v11-herr-titulo').textContent='Nueva herramienta';
  limpiarMensajeV11('v11-herr-mensaje');
}
function abrirHerramientaNueva(){limpiarFormularioHerramienta();abrirModal('modal-v9-herr');}
function abrirHerramientaEditar(id){
  const raw=(window.v9Herr||[]).find(x=>String(x.id)===String(id));if(!raw)return;
  const v=datosHerrV11(raw);
  if($('v11-herr-titulo'))$('v11-herr-titulo').textContent='Editar herramienta';
  if($('v11-herr-id'))$('v11-herr-id').value=v.id||'';
  if($('v9-herr-codigo'))$('v9-herr-codigo').value=v.codigo||'';
  if($('v9-herr-nombre'))$('v9-herr-nombre').value=v.nombre||'';
  if($('v11-herr-serie'))$('v11-herr-serie').value=v.serie||'';
  if($('v11-herr-marca'))$('v11-herr-marca').value=v.marca||'';
  if($('v11-herr-modelo'))$('v11-herr-modelo').value=v.modelo||'';
  if($('v11-herr-ubicacion'))$('v11-herr-ubicacion').value=v.ubicacion||'';
  if($('v9-herr-obs'))$('v9-herr-obs').value=v.observaciones||'';
  limpiarMensajeV11('v11-herr-mensaje');abrirModal('modal-v9-herr');
}
$('btn-nueva-herramienta')?.addEventListener('click',abrirHerramientaNueva);
$('v9-guardar-herr')?.addEventListener('click',async()=>{
  limpiarMensajeV11('v11-herr-mensaje');
  const id=$('v11-herr-id')?.value||'';
  const nombre=$('v9-herr-nombre')?.value.trim()||'';
  const serie=$('v11-herr-serie')?.value.trim()||'';
  if(!nombre){mostrarErrorV11('v11-herr-mensaje',null,'El nombre de la herramienta es obligatorio.');return;}
  if(!serie){mostrarErrorV11('v11-herr-mensaje',null,'El número de serie es obligatorio.');return;}
  const boton=$('v9-guardar-herr');const original=boton?.textContent||'Guardar';
  if(boton){boton.disabled=true;boton.textContent='Guardando...';}
  try{
    const actual=id?(window.v9Herr||[]).find(x=>String(x.id)===String(id)):null;
    if(actual){
      const registro={nombre,observaciones:$('v9-herr-obs')?.value.trim()||null};
      const candidatos={numero_serie:serie,serie,marca:$('v11-herr-marca')?.value.trim()||null,modelo:$('v11-herr-modelo')?.value.trim()||null,ubicacion:$('v11-herr-ubicacion')?.value.trim()||null};
      for(const [k,v] of Object.entries(candidatos))if(Object.prototype.hasOwnProperty.call(actual,k))registro[k]=v;
      const {error}=await sb.from('herramientas_especiales').update(registro).eq('id',id);
      if(error){mostrarErrorV11('v11-herr-mensaje',error,'No fue posible actualizar la herramienta.');return;}
    }else{
      const codigo=($('v9-herr-codigo')?.value.trim())||generarCodigoHerramientaV11();
      const registro={codigo,nombre,observaciones:$('v9-herr-obs')?.value.trim()||null};
      const {data,error}=await sb.from('herramientas_especiales').insert(registro).select().single();
      if(error){mostrarErrorV11('v11-herr-mensaje',error,'No fue posible registrar la herramienta.');return;}
      if($('v9-herr-codigo'))$('v9-herr-codigo').value=data?.codigo||codigo;
    }
    cerrarModal('modal-v9-herr');await cargarHerramientas();await dashboard();
  }catch(error){mostrarErrorV11('v11-herr-mensaje',error,'Ocurrió un error inesperado al guardar la herramienta.');}
  finally{if(boton){boton.disabled=false;boton.textContent=original;}}
});
async function prestamo(id){
  if($('v9-prestamo-id'))$('v9-prestamo-id').value=id;
  if($('v9-prestamo-obs'))$('v9-prestamo-obs').value='';
  const [{data:t,error:et},{data:o,error:eo}]=await Promise.all([sb.from('perfiles').select('id,nombre_completo').eq('rol','tecnico').eq('activo',true),sb.from('ordenes_trabajo').select('id,folio').eq('estado','abierta')]);
  if(et){alert(et.message||'No fue posible cargar los técnicos.');return;}
  if(eo)console.error('No fue posible cargar las OT abiertas:',eo);
  if($('v9-prestamo-tecnico'))$('v9-prestamo-tecnico').innerHTML='<option value="">Selecciona…</option>'+(t||[]).map(x=>`<option value="${x.id}">${escapar(x.nombre_completo)}</option>`).join('');
  if($('v9-prestamo-ot'))$('v9-prestamo-ot').innerHTML='<option value="">Sin OT</option>'+(o||[]).map(x=>`<option value="${x.id}">${escapar(x.folio)}</option>`).join('');
  abrirModal('modal-v9-prestamo');
}
$('v9-confirmar-prestamo')?.addEventListener('click',async()=>{
  const tecnico=$('v9-prestamo-tecnico')?.value||'';if(!tecnico){alert('Selecciona un técnico.');return;}
  const {error}=await sb.rpc('prestar_herramienta',{p_herramienta_id:$('v9-prestamo-id').value,p_tecnico_id:tecnico,p_orden_id:$('v9-prestamo-ot').value||null,p_observacion:$('v9-prestamo-obs').value||null});
  if(error){console.error('Error al prestar herramienta:',error);alert(error.message||'No fue posible prestar la herramienta.');return;}
  cerrarModal('modal-v9-prestamo');await cargarHerramientas();dashboard();
});
function abrirDevolucion(id){
  if($('modal-v11-devolucion')&&$('v11-devolucion-id')){$('v11-devolucion-id').value=id;if($('v11-devolucion-obs'))$('v11-devolucion-obs').value='';limpiarMensajeV11('v11-devolucion-mensaje');abrirModal('modal-v11-devolucion');return;}
  devolverHerramientaDirecta(id);
}
async function devolverHerramientaDirecta(id){
  const {error}=await sb.rpc('devolver_herramienta',{p_herramienta_id:id,p_observacion:null});
  if(error){console.error('Error devolviendo herramienta:',error);alert(error.message||'No fue posible devolver la herramienta.');return;}
  await cargarHerramientas();dashboard();
}
$('v11-confirmar-devolucion')?.addEventListener('click',async()=>{
  limpiarMensajeV11('v11-devolucion-mensaje');
  const id=$('v11-devolucion-id')?.value;if(!id)return;
  const boton=$('v11-confirmar-devolucion'),original=boton.textContent;boton.disabled=true;boton.textContent='Devolviendo...';
  const {error}=await sb.rpc('devolver_herramienta',{p_herramienta_id:id,p_observacion:$('v11-devolucion-obs')?.value.trim()||null});
  boton.disabled=false;boton.textContent=original;
  if(error){mostrarErrorV11('v11-devolucion-mensaje',error,'No fue posible devolver la herramienta.');return;}
  cerrarModal('modal-v11-devolucion');await cargarHerramientas();dashboard();
});
async function abrirHistorialHerramienta(id){
  const raw=(window.v9Herr||[]).find(x=>String(x.id)===String(id));const v=datosHerrV11(raw||{});
  if($('v11-historial-titulo'))$('v11-historial-titulo').textContent='Historial de herramienta';
  if($('v11-historial-subtitulo'))$('v11-historial-subtitulo').textContent=[v.codigo,v.nombre,v.serie].filter(Boolean).join(' · ')||'—';
  const tbody=$('v11-tabla-historial');if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="7" class="vacio-tabla">Cargando…</td></tr>';
  abrirModal('modal-v11-historial');
  const {data,error}=await sb.rpc('v11_herramienta_historial',{p_herramienta_id:id});
  if(error){console.error('Error historial herramienta:',error);tbody.innerHTML=`<tr><td colspan="7" class="vacio-tabla">${escapar(error.message||'No fue posible cargar el historial.')}</td></tr>`;return;}
  if(!data||!data.length){tbody.innerHTML='<tr><td colspan="7" class="vacio-tabla">Sin movimientos registrados.</td></tr>';return;}
  tbody.innerHTML=data.map(m=>`<tr><td>${escapar(fechaHora(m.salida_at))}</td><td>${escapar(m.devolucion_at?fechaHora(m.devolucion_at):'Pendiente')}</td><td>${escapar(texto(m.tecnico))}</td><td>${escapar(texto(m.orden_folio))}</td><td>${escapar(texto(m.entregado_por))}</td><td>${escapar(texto(m.recibido_por))}</td><td>${escapar([m.observacion_salida,m.observacion_devolucion].filter(Boolean).join(' / ')||'—')}</td></tr>`).join('');
}

// bitácora amigable admin
window.cargarBitacora=async function(){if(!admin())return;const {data}=await sb.rpc('bitacora_amigable');if(!$('tabla-bitacora'))return;$('tabla-bitacora').innerHTML=(data||[]).map(x=>`<tr><td>${new Date(x.fecha).toLocaleString('es-MX')}</td><td>${escapar(x.usuario_nombre||'Sistema')}</td><td>${escapar(x.resumen)}</td><td><button class="btn secundario pequeno" data-det="${encodeURIComponent(JSON.stringify(x.detalle||{}))}">Ver detalle</button></td></tr>`).join('');document.querySelectorAll('[data-det]').forEach(b=>b.onclick=()=>alert(Object.entries(JSON.parse(decodeURIComponent(b.dataset.det))).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n')));};

setTimeout(()=>{aplicarPermisos();activarModulos();dashboard();bloquearCot();adicionales();},600);
})();
