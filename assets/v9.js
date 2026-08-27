// Taller Automotriz V9 - capa de integración sobre V8
(() => {
const $=id=>document.getElementById(id); let otId=null;
function admin(){return estado?.perfil?.rol==='administrador'}
function staff(){return ['administrador','recepcion'].includes(estado?.perfil?.rol)}
function hoy(){return new Date().toISOString().slice(0,10)}
function aplicarPermisos(){const r=estado?.perfil?.rol;document.querySelectorAll('[data-admin-only]').forEach(x=>x.style.display=r==='administrador'?'':'none');if(r==='tecnico'){document.querySelectorAll('.nav-item').forEach(x=>{if(!['inicio','ordenes','herramientas'].includes(x.dataset.modulo))x.style.display='none'});}}
function activarModulos(){document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>{const f={ordenes:cargarOT,carga:cargarCarga,ingresos:cargarIngresos,herramientas:cargarHerramientas}[n.dataset.modulo];if(f)setTimeout(f,0)}));}
async function dashboard(){const {data}=await sb.rpc('dashboard_v9');if(!data)return;$('dash-ot-abiertas').textContent=data.ot_abiertas||0;$('dash-trabajos-pendientes').textContent=data.trabajos_pendientes||0;$('dash-ot-terminadas').textContent=data.ot_terminadas_hoy||0;$('dash-ingresos-hoy').textContent='$'+money(data.ingresos_hoy||0);$('dash-avance-ordenes').innerHTML=(data.ordenes||[]).map(o=>`<div><strong>${o.folio}</strong> · ${o.placa} · ${o.realizados}/${o.total}<div class="v9-progreso"><span style="width:${o.total?o.realizados/o.total*100:0}%"></span></div></div>`).join('')||'<small>Sin órdenes abiertas.</small>';$('dash-herramientas').textContent=`Disponibles ${data.herramientas_disponibles||0} · Prestadas ${data.herramientas_prestadas||0} · Fuera de servicio ${data.herramientas_fuera||0}`;$('dash-pagos').innerHTML=(data.ultimos_pagos||[]).map(p=>`<div>${p.folio} · $${money(p.importe)} · ${p.metodo}</div>`).join('')||'<small>Sin pagos hoy.</small>';}
// Descuento general: compatibilidad con V8. Internamente usa el descuento del primer renglón, pero la UI es general.
function calcDesc(){const tipo=document.querySelector('input[name="v9-desc-tipo"]:checked')?.value||'ninguno',v=Number($('v9-desc-valor').value||0),sub=estado.conceptosEnEdicion.reduce((s,c)=>s+(Number(c.cantidad)||0)*(Number(c.precio_unitario)||0),0);let d=tipo==='porcentaje'?Math.min(sub,sub*Math.min(v,100)/100):tipo==='monto'?Math.min(sub,v):0;estado.conceptosEnEdicion.forEach(c=>c.descuento=0);if(estado.conceptosEnEdicion[0])estado.conceptosEnEdicion[0].descuento=d;$('v9-desc-texto').textContent=tipo==='porcentaje'?`${v}%`:tipo==='monto'?`$${money(v)}`:'Sin descuento';recalcularTotales();}
document.querySelectorAll('input[name="v9-desc-tipo"]').forEach(r=>r.addEventListener('change',()=>{$('v9-desc-valor').disabled=r.checked&&r.value==='ninguno';calcDesc()}));$('v9-desc-valor')?.addEventListener('input',calcDesc);
const renderOriginal=window.renderConceptos; if(renderOriginal){window.renderConceptos=function(){renderOriginal(); document.querySelectorAll('#cuerpo-conceptos [data-campo="descuento"]').forEach(i=>i.closest('td').style.display='none'); bloquearCot();};}
function bloquearCot(){const aut=$('cotizacion-estado-comercial')?.value==='autorizada';$('v9-adicionales').style.display=aut?'block':'none';$('btn-v9-ot').style.display=aut?'inline-block':'none';if(aut&&!admin()){document.querySelectorAll('#cuerpo-conceptos [data-campo]').forEach(i=>{i.disabled=true;i.classList.add('v9-lock')});document.querySelectorAll('#cuerpo-conceptos [data-quitar]').forEach(b=>b.style.display='none');$('btn-agregar-concepto').style.display='none';$('btn-cat-agregar').style.display='none';document.querySelectorAll('.v9-descuento input').forEach(i=>i.disabled=true);const e=$('cotizacion-estado-comercial');[...e.options].forEach(o=>o.disabled=!['autorizada','cerrada'].includes(o.value));}else if(aut&&admin()){const e=$('cotizacion-estado-comercial');[...e.options].forEach(o=>o.disabled=!['autorizada','cerrada','cancelada'].includes(o.value));}}
$('cotizacion-estado-comercial')?.addEventListener('change',()=>setTimeout(bloquearCot,0));
// adicionales
async function adicionales(){const id=$('cotizacion-id')?.value;if(!id)return;const {data}=await sb.from('cotizacion_adicionales').select('*').eq('cotizacion_id',id).order('created_at');$('v9-lista-adicionales').innerHTML=(data||[]).map(a=>`<div class="v9-adicional"><b>${a.descripcion}</b> · ${a.cantidad} × $${money(a.precio_unitario)} <span class="badge ${a.estado==='autorizado'?'verde':a.estado==='no_autorizado'?'rojo':'naranja'}">${a.estado}</span>${a.observacion?`<div>${a.observacion}</div>`:''}${a.estado==='pendiente'&&staff()?`<button class="btn pequeno" data-a="${a.id}">Autorizar</button> <button class="btn secundario pequeno" data-n="${a.id}">No autorizar</button>`:''}</div>`).join('')||'<small>Sin adicionales.</small>';document.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{await sb.rpc('resolver_adicional',{p_adicional_id:b.dataset.a,p_estado:'autorizado'});adicionales()});document.querySelectorAll('[data-n]').forEach(b=>b.onclick=async()=>{await sb.rpc('resolver_adicional',{p_adicional_id:b.dataset.n,p_estado:'no_autorizado'});adicionales()});}
$('btn-v9-adicional')?.addEventListener('click',()=>abrirModal('modal-v9-adicional'));$('v9-guardar-adicional')?.addEventListener('click',async()=>{const {error}=await sb.from('cotizacion_adicionales').insert({cotizacion_id:$('cotizacion-id').value,descripcion:$('v9-ad-desc').value.trim(),cantidad:Number($('v9-ad-cant').value||1),precio_unitario:Number($('v9-ad-precio').value||0),observacion:$('v9-ad-obs').value.trim()||null,created_by:estado.usuario.id});if(!error){cerrarModal('modal-v9-adicional');adicionales()}});
// OT
async function cargarOT(){let q=sb.rpc('ordenes_trabajo_listar');const {data}=await q;let l=data||[];if(estado.perfil?.rol==='tecnico')l=l.filter(x=>x.tecnico_id===estado.usuario.id);window.v9OT=l;renderOT();}
function renderOT(){const txt=($('buscar-orden').value||'').toLowerCase(),f=$('filtro-orden').value;let l=window.v9OT||[];if(txt)l=l.filter(x=>[x.folio,x.cotizacion_folio,x.placa].some(v=>(v||'').toLowerCase().includes(txt)));if(f)l=l.filter(x=>x.estado===f);$('tabla-ordenes').innerHTML=l.map(x=>`<tr><td>${x.folio}</td><td>${x.cotizacion_folio}</td><td>${x.placa} · ${x.vehiculo}</td><td>${x.tecnico||'Sin asignar'}</td><td>${x.realizados}/${x.total}</td><td>${x.estado}</td><td><button class="btn secundario pequeno" data-ot="${x.id}">Abrir</button></td></tr>`).join('');document.querySelectorAll('[data-ot]').forEach(b=>b.onclick=()=>abrirOT(b.dataset.ot));}
$('buscar-orden')?.addEventListener('input',renderOT);$('filtro-orden')?.addEventListener('change',renderOT);$('btn-v9-ot')?.addEventListener('click',async()=>{const {data,error}=await sb.rpc('generar_orden_trabajo',{p_cotizacion_id:$('cotizacion-id').value});if(!error)abrirOT(data)});
function obtenerChecksOT() {
    return [...document.querySelectorAll('[data-check]')];
}

function obtenerAvanceOT() {
    const checks = obtenerChecksOT();
    const total = checks.length;
    const realizados = checks.filter(x => x.checked).length;
    const pendientes = total - realizados;
    const porcentaje = total ? Math.round((realizados / total) * 100) : 0;
    return { total, realizados, pendientes, porcentaje };
}

function actualizarAvanceOT() {
    const avance = obtenerAvanceOT();
    const contador = $('v9-ot-contador');
    const porcentaje = $('v9-ot-porcentaje');
    const barra = $('v9-ot-barra');
    const seleccionarTodos = $('v9-seleccionar-todos');
    const finalizar = $('v9-finalizar-ot');
    const ayuda = $('v9-finalizar-ayuda');
    if (contador) contador.textContent = `${avance.realizados} de ${avance.total} realizados`;
    if (porcentaje) porcentaje.textContent = `${avance.porcentaje}%`;
    if (barra) barra.style.width = `${avance.porcentaje}%`;
    if (seleccionarTodos) {
        seleccionarTodos.indeterminate = avance.realizados > 0 && avance.realizados < avance.total;
        seleccionarTodos.checked = avance.total > 0 && avance.realizados === avance.total;
    }
    if (finalizar && !window.v9OTTerminada) {
        const completo = avance.total > 0 && avance.realizados === avance.total;
        finalizar.disabled = !completo;
        finalizar.style.opacity = completo ? '1' : '0.55';
        finalizar.style.cursor = completo ? 'pointer' : 'not-allowed';
        if (ayuda) {
            ayuda.textContent = completo
                ? 'Todos los trabajos estan realizados. La OT puede finalizarse.'
                : avance.total
                    ? `Faltan ${avance.pendientes} trabajos por completar.`
                    : 'La orden no contiene trabajos.';
            ayuda.style.color = completo ? '#18794e' : '#9a6700';
        }
    }
}

function configurarSeleccionTodosOT() {
    const seleccionarTodos = $('v9-seleccionar-todos');
    if (!seleccionarTodos) return;
    seleccionarTodos.onchange = () => {
        if (window.v9OTTerminada) return;
        const valor = seleccionarTodos.checked;
        obtenerChecksOT().forEach(check => { check.checked = valor; });
        actualizarAvanceOT();
    };
}

function configurarChecksOT() {
    obtenerChecksOT().forEach(check => {
        check.onchange = () => {
            if (window.v9OTTerminada) return;
            actualizarAvanceOT();
        };
    });
}

function aplicarModoOT(terminada) {
    window.v9OTTerminada = terminada;
    const tecnico = $('v9-ot-tecnico');
    const observaciones = $('v9-ot-observaciones');
    const guardar = $('v9-guardar-ot');
    const finalizar = $('v9-finalizar-ot');
    const seleccionarTodos = $('v9-seleccionar-todos');
    const estadoVisual = $('v9-ot-estado-visual');
    if (terminada) {
        if (tecnico) tecnico.disabled = true;
        if (observaciones) observaciones.disabled = true;
        obtenerChecksOT().forEach(x => { x.disabled = true; });
        if (seleccionarTodos) {
            seleccionarTodos.disabled = true;
            const c = seleccionarTodos.closest('.v9-seleccionar-todos-contenedor');
            if (c) c.style.display = 'none';
        }
        if (guardar) guardar.style.display = 'none';
        if (finalizar) finalizar.style.display = 'none';
        if (estadoVisual) {
            estadoVisual.textContent = 'TERMINADA';
            estadoVisual.className = 'v9-ot-estado v9-ot-estado-terminada';
        }
    } else {
        if (tecnico) tecnico.disabled = false;
        if (observaciones) observaciones.disabled = false;
        obtenerChecksOT().forEach(x => { x.disabled = false; });
        if (seleccionarTodos) {
            seleccionarTodos.disabled = false;
            const c = seleccionarTodos.closest('.v9-seleccionar-todos-contenedor');
            if (c) c.style.display = '';
        }
        if (guardar) guardar.style.display = '';
        if (finalizar) finalizar.style.display = '';
        if (estadoVisual) {
            estadoVisual.textContent = 'ABIERTA';
            estadoVisual.className = 'v9-ot-estado v9-ot-estado-abierta';
        }
    }
    actualizarAvanceOT();
}

async function abrirOT(id) {
    otId = id;
    const [
        { data: o, error: errorOrden },
        { data: d, error: errorDetalle },
        { data: t, error: errorTecnicos }
    ] = await Promise.all([
        sb.from('ordenes_trabajo').select('*,cotizaciones(folio),vehiculos(placa,marca,modelo)').eq('id',id).single(),
        sb.from('orden_trabajo_detalle').select('*').eq('orden_trabajo_id',id).order('created_at'),
        sb.from('perfiles').select('id,nombre_completo').eq('rol','tecnico').eq('activo',true)
    ]);
    if (errorOrden) { console.error('Error al cargar OT:', errorOrden); alert('No fue posible cargar la orden de trabajo.'); return; }
    if (errorDetalle) { console.error('Error al cargar detalle OT:', errorDetalle); alert('No fue posible cargar los trabajos de la orden.'); return; }
    if (errorTecnicos) console.error('Error al cargar tecnicos:', errorTecnicos);

    $('v9-ot-titulo').textContent = `Orden ${o.folio}`;
    $('v9-ot-resumen').innerHTML = `
        <div class="v9-ot-resumen-grid">
            <div><small>Cotizacion</small><strong>${o.cotizaciones?.folio || '—'}</strong></div>
            <div><small>Vehiculo</small><strong>${o.vehiculos?.placa || '—'} · ${o.vehiculos?.marca || ''} ${o.vehiculos?.modelo || ''}</strong></div>
            <div><small>Estado</small><strong id="v9-ot-estado-visual" class="v9-ot-estado">${o.estado === 'terminada' ? 'TERMINADA' : 'ABIERTA'}</strong></div>
        </div>`;
    $('v9-ot-tecnico').innerHTML = '<option value="">Sin asignar</option>' + (t || []).map(x => `<option value="${x.id}" ${x.id === o.tecnico_id ? 'selected' : ''}>${x.nombre_completo}</option>`).join('');
    $('v9-ot-asignacion').style.display = estado.perfil?.rol === 'tecnico' ? 'none' : 'block';
    $('v9-ot-trabajos').innerHTML = `
        <div class="v9-avance-cabecera">
            <div><strong>Avance del servicio</strong><div id="v9-ot-contador" class="v9-avance-contador">0 de 0 realizados</div></div>
            <div id="v9-ot-porcentaje" class="v9-avance-porcentaje">0%</div>
        </div>
        <div class="v9-progreso v9-progreso-ot"><span id="v9-ot-barra" style="width:0%"></span></div>
        <label class="v9-seleccionar-todos-contenedor"><input id="v9-seleccionar-todos" type="checkbox"><strong>Seleccionar todos los trabajos</strong></label>
        <div class="v9-lista-trabajos">${(d || []).map(x => `<label class="v9-check"><input data-check="${x.id}" type="checkbox" ${x.realizado ? 'checked' : ''}><span>${x.descripcion}</span></label>`).join('')}</div>
        <div id="v9-finalizar-ayuda" class="v9-finalizar-ayuda"></div>`;
    $('v9-ot-observaciones').value = o.observaciones || '';
    configurarSeleccionTodosOT();
    configurarChecksOT();
    aplicarModoOT(o.estado === 'terminada');
    abrirModal('modal-v9-orden');
}

$('v9-guardar-ot')?.addEventListener('click', async () => {
    if (!otId) return;
    if (window.v9OTTerminada) { alert('Esta orden ya esta terminada y no puede modificarse.'); return; }
    const checks = obtenerChecksOT().map(x => ({ id:x.dataset.check, realizado:x.checked }));
    const boton = $('v9-guardar-ot');
    const textoOriginal = boton.textContent;
    boton.disabled = true; boton.textContent = 'Guardando...';
    const { error } = await sb.rpc('guardar_avance_orden', {
        p_orden_id:otId,
        p_checks:checks,
        p_observaciones:$('v9-ot-observaciones').value,
        p_tecnico_id:$('v9-ot-tecnico').value || null
    });
    boton.disabled = false; boton.textContent = textoOriginal;
    if (error) { console.error('Error al guardar avance:', error); alert(error.message || 'No fue posible guardar el avance.'); return; }
    await cargarOT();
    actualizarAvanceOT();
    alert('Avance guardado correctamente.');
});

$('v9-finalizar-ot')?.addEventListener('click', async () => {
    if (!otId || window.v9OTTerminada) return;
    const avance = obtenerAvanceOT();
    if (!avance.total) { alert('La orden no contiene trabajos para finalizar.'); return; }
    if (avance.pendientes > 0) {
        alert(`No puedes finalizar esta orden.\n\nAvance: ${avance.realizados} de ${avance.total}.\nQuedan ${avance.pendientes} trabajos pendientes.`);
        return;
    }
    if (!confirm(`Finalizar orden de trabajo\n\n${avance.realizados} de ${avance.total} trabajos estan realizados.\n\nLa orden quedara marcada como terminada.\n\n¿Deseas continuar?`)) return;
    const boton = $('v9-finalizar-ot');
    const textoOriginal = boton.textContent;
    boton.disabled = true; boton.textContent = 'Finalizando...';
    const { error } = await sb.rpc('finalizar_orden',{p_orden_id:otId});
    if (error) {
        console.error('Error al finalizar OT:', error);
        boton.disabled = false; boton.textContent = textoOriginal;
        alert(error.message || 'No fue posible finalizar la orden.');
        return;
    }
    await cargarOT();
    cerrarModal('modal-v9-orden');
});

$('v9-imprimir-ot')?.addEventListener('click', () => {
    const avance = obtenerAvanceOT();
    const w = window.open('','_blank');
    w.document.write(`<html><head><title>${$('v9-ot-titulo').textContent}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#1b2f4a}h1{border-bottom:2px solid #1b7884;padding-bottom:10px}h2{margin-top:28px;font-size:18px}.trabajo{padding:8px 0;border-bottom:1px solid #ddd}.avance{margin:15px 0;font-weight:bold}</style></head><body><h1>${$('v9-ot-titulo').textContent}</h1>${$('v9-ot-resumen').innerHTML}<h2>Trabajos autorizados</h2><div class="avance">Avance: ${avance.realizados} de ${avance.total} (${avance.porcentaje}%)</div>${obtenerChecksOT().map(x => `<div class="trabajo">${x.checked ? '☑' : '☐'} ${x.parentElement.innerText}</div>`).join('')}<h2>Refacciones / caja</h2><p>Las piezas retiradas deberan colocarse en la caja correspondiente al vehiculo.</p><h2>Observaciones</h2><p>${$('v9-ot-observaciones').value || 'Sin observaciones.'}</p></body></html>`);
    w.document.close(); w.focus(); w.print();
});
// carga operativa (sin ranking)
async function cargarCarga(){if(!admin())return;const mes=$('carga-mes').value||new Date().toISOString().slice(0,7);$('carga-mes').value=mes;const {data}=await sb.rpc('carga_trabajo_operativa',{p_mes:mes});$('carga-tecnicos').innerHTML=(data||[]).map(x=>`<div class="panel"><h3>${x.tecnico}</h3><p>Órdenes abiertas: <b>${x.ordenes_abiertas}</b> · Trabajos pendientes: <b>${x.trabajos_pendientes}</b> · Órdenes atendidas en el mes: <b>${x.ordenes_mes}</b></p></div>`).join('')||'<div class="panel">Sin datos.</div>'}$('carga-mes')?.addEventListener('change',cargarCarga);
// ingresos: consulta únicamente
async function cargarIngresos(){const f=$('ingresos-fecha').value||hoy();$('ingresos-fecha').value=f;const {data}=await sb.rpc('ingresos_por_dia',{p_fecha:f});let l=data||[],m=$('ingresos-metodo').value;if(m)l=l.filter(x=>x.metodo===m);const sum=m=>l.filter(x=>x.estado==='valido'&&(!m||x.metodo===m)).reduce((s,x)=>s+Number(x.importe),0);$('ing-total').textContent='$'+money(sum());$('ing-efectivo').textContent='$'+money(sum('efectivo'));$('ing-transferencia').textContent='$'+money(sum('transferencia'));$('ing-tarjeta').textContent='$'+money(sum('tarjeta'));$('tabla-ingresos').innerHTML=l.map(x=>`<tr><td>${new Date(x.fecha_hora).toLocaleTimeString('es-MX')}</td><td>${x.folio}</td><td>${x.cliente} · ${x.placa}</td><td>${x.metodo}</td><td>${x.referencia||'—'}</td><td>$${money(x.importe)}</td><td>${x.estado}</td></tr>`).join('')}$('ingresos-fecha')?.addEventListener('change',cargarIngresos);$('ingresos-metodo')?.addEventListener('change',cargarIngresos);
// herramientas
async function cargarHerramientas(){const {data}=await sb.rpc('herramientas_listar');window.v9Herr=data||[];renderHerr()}
function renderHerr(){const t=($('buscar-herramienta').value||'').toLowerCase(),f=$('filtro-herramienta').value;let l=window.v9Herr||[];if(t)l=l.filter(x=>(x.codigo+x.nombre).toLowerCase().includes(t));if(f)l=l.filter(x=>x.estado===f);$('tabla-herramientas').innerHTML=l.map(x=>`<tr><td>${x.codigo}</td><td>${x.nombre}</td><td>${x.estado}</td><td>${x.asignada_a||'—'}</td><td>${x.desde?new Date(x.desde).toLocaleString('es-MX'):'—'}</td><td>${x.estado==='disponible'&&staff()?`<button class="btn pequeno" data-prestar="${x.id}">Prestar</button>`:''}${x.estado==='prestada'&&staff()?` <button class="btn secundario pequeno" data-devolver="${x.id}">Devolver</button>`:''}</td></tr>`).join('');document.querySelectorAll('[data-prestar]').forEach(b=>b.onclick=()=>prestamo(b.dataset.prestar));document.querySelectorAll('[data-devolver]').forEach(b=>b.onclick=async()=>{await sb.rpc('devolver_herramienta',{p_herramienta_id:b.dataset.devolver,p_observacion:null});cargarHerramientas()})}$('buscar-herramienta')?.addEventListener('input',renderHerr);$('filtro-herramienta')?.addEventListener('change',renderHerr);$('btn-nueva-herramienta')?.addEventListener('click',()=>abrirModal('modal-v9-herr'));$('v9-guardar-herr')?.addEventListener('click',async()=>{await sb.from('herramientas_especiales').insert({codigo:$('v9-herr-codigo').value,nombre:$('v9-herr-nombre').value,observaciones:$('v9-herr-obs').value||null});cerrarModal('modal-v9-herr');cargarHerramientas()});async function prestamo(id){$('v9-prestamo-id').value=id;const [{data:t},{data:o}]=await Promise.all([sb.from('perfiles').select('id,nombre_completo').eq('rol','tecnico').eq('activo',true),sb.from('ordenes_trabajo').select('id,folio').eq('estado','abierta')]);$('v9-prestamo-tecnico').innerHTML='<option value="">Selecciona…</option>'+(t||[]).map(x=>`<option value="${x.id}">${x.nombre_completo}</option>`).join('');$('v9-prestamo-ot').innerHTML='<option value="">Sin OT</option>'+(o||[]).map(x=>`<option value="${x.id}">${x.folio}</option>`).join('');abrirModal('modal-v9-prestamo')}$('v9-confirmar-prestamo')?.addEventListener('click',async()=>{await sb.rpc('prestar_herramienta',{p_herramienta_id:$('v9-prestamo-id').value,p_tecnico_id:$('v9-prestamo-tecnico').value,p_orden_id:$('v9-prestamo-ot').value||null,p_observacion:$('v9-prestamo-obs').value||null});cerrarModal('modal-v9-prestamo');cargarHerramientas()});
// bitácora amigable admin. Solo cambia visualización si módulo existe.
window.cargarBitacora=async function(){if(!admin())return;const {data}=await sb.rpc('bitacora_amigable');$('tabla-bitacora').innerHTML=(data||[]).map(x=>`<tr><td>${new Date(x.fecha).toLocaleString('es-MX')}</td><td>${x.usuario_nombre||'Sistema'}</td><td>${x.resumen}</td><td><button class="btn secundario pequeno" data-det='${encodeURIComponent(JSON.stringify(x.detalle||{}))}'>Ver detalle</button></td></tr>`).join('');document.querySelectorAll('[data-det]').forEach(b=>b.onclick=()=>alert(Object.entries(JSON.parse(decodeURIComponent(b.dataset.det))).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n')))};
// Oculta menú usuarios/bitácora para no admin. Reversos quedan visualmente solo admin en V8 y backend V9 exige reautenticación para endpoint nuevo.
setTimeout(()=>{aplicarPermisos();activarModulos();dashboard();bloquearCot();adicionales()},600);
})();
