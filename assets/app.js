/ ============================================================================

// Sistema Taller Automotriz · app.js · Versión V10

// V6 (captura inline + identidad permanente) + V7 (gate pagos, gestión usuarios)

// + V8 (cascada de catálogo maestro en la cotización + creación de combos).

// ============================================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



const estado = {

  usuario: null, perfil: null,

  clientes: [], vehiculos: [], servicios: [], categorias: [], catalogoMaestro: [],

  cotizacionActualId: null, conceptosEnEdicion: [],

};

const seleccion = { clienteId: null, vehiculoId: null };



// ---------------------------------------------------------------------------

// Utilidades

// ---------------------------------------------------------------------------

function money(n) { return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function el(id) { return document.getElementById(id); }

function mostrarMensaje(idc, texto, tipo = "ok") {

  const c = el(idc); if (!c) return;

  c.innerHTML = `<div class="mensaje ${tipo}">${texto}</div>`;

  setTimeout(() => { c.innerHTML = ""; }, 4500);

}

async function registrarBitacora(tabla, registroId, accion, anteriores, nuevos) {

  try {

    await sb.from("bitacora").insert({ tabla_afectada: tabla, registro_id: registroId, accion, valores_anteriores: anteriores || null, valores_nuevos: nuevos || null, usuario_id: estado.usuario ? estado.usuario.id : null });

  } catch (e) { console.warn("Bitácora:", e); }

}

function abrirModal(id) { el(id).classList.add("activo"); }

function cerrarModal(id) { el(id).classList.remove("activo"); }

function puedeEscribir() { return !!(estado.perfil && estado.perfil.rol !== "consulta"); }

function esAdmin() { return !!(estado.perfil && estado.perfil.rol === "administrador"); }



document.querySelectorAll("[data-cerrar-modal]").forEach(b => b.addEventListener("click", () => cerrarModal(b.dataset.cerrarModal)));



const ETIQUETAS_COMERCIAL = { borrador:"Borrador", enviada:"Enviada", pendiente_autorizacion:"Pend. autorización", autorizada:"Autorizada", rechazada:"Rechazada", cancelada:"Cancelada", cerrada:"Cerrada" };

const ETIQUETAS_SERVICIO = { sin_iniciar:"Sin iniciar", diagnostico:"Diagnóstico", esperando_refacciones:"Esperando refacciones", en_proceso:"En proceso", terminado:"Terminado", vehiculo_entregado:"Vehículo entregado" };

function badgeComercial(v){ const c={borrador:"gris",enviada:"naranja",pendiente_autorizacion:"naranja",autorizada:"verde",rechazada:"rojo",cancelada:"rojo",cerrada:"gris"}; return `<span class="badge ${c[v]||"gris"}">${ETIQUETAS_COMERCIAL[v]||v}</span>`; }

function badgeServicio(v){ return `<span class="badge azul">${ETIQUETAS_SERVICIO[v]||v}</span>`; }



// ============================================================================

// AUTENTICACIÓN

// ============================================================================

el("form-login").addEventListener("submit", async (ev) => {

  ev.preventDefault();

  el("login-error").textContent = "";

  let entrada = el("login-correo").value.trim();

  const clave = el("login-clave").value;

  if (!entrada.includes("@")) {

    const { data: correo, error } = await sb.rpc("correo_por_username", { p_username: entrada });

    if (error || !correo) { el("login-error").textContent = "Usuario no encontrado o inactivo."; return; }

    entrada = correo;

  }

  const { data, error } = await sb.auth.signInWithPassword({ email: entrada, password: clave });

  if (error) { el("login-error").textContent = "Usuario o contraseña incorrectos."; return; }

  await iniciarSesionExitosa(data.session);

});

el("btn-salir").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });



async function iniciarSesionExitosa(session) {

  estado.usuario = session.user;

  const { data: perfil } = await sb.from("perfiles").select("*").eq("id", session.user.id).single();

  estado.perfil = perfil;

  el("pantalla-login").style.display = "none";

  el("app-shell").classList.add("activo");

  el("pie-usuario").textContent = (perfil && perfil.nombre_completo) || session.user.email;

  el("pie-rol").textContent = perfil ? `Rol: ${perfil.rol}` : "";

  if (perfil && perfil.rol === "administrador") document.querySelectorAll("[data-admin-only]").forEach(n => n.style.display = "block");

  if (perfil && perfil.rol === "consulta") document.querySelectorAll(".solo-staff").forEach(n => n.style.display = "none");

  await cargarDatosBase();

  cargarInicio();

}

async function verificarSesion() { const { data } = await sb.auth.getSession(); if (data.session) await iniciarSesionExitosa(data.session); }

verificarSesion();



// ============================================================================

// NAVEGACIÓN

// ============================================================================

document.querySelectorAll(".nav-item").forEach(item => {

  item.addEventListener("click", () => {

    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("activo"));

    item.classList.add("activo");

    document.querySelectorAll(".modulo").forEach(m => m.classList.remove("activo"));

    el("modulo-" + item.dataset.modulo).classList.add("activo");

    const cargas = { inicio:cargarInicio, cotizaciones:cargarCotizaciones, clientes:cargarClientes, vehiculos:cargarVehiculos, catalogo:cargarCatalogo, bitacora:cargarBitacora, usuarios:cargarUsuarios };

    if (cargas[item.dataset.modulo]) cargas[item.dataset.modulo]();

  });

});



async function cargarDatosBase() {

  const [{ data: clientes }, { data: vehiculos }, { data: catalogo, error: errorCatalogo }] = await Promise.all([

    sb.from("clientes").select("*").order("nombre_completo"),

    sb.from("vehiculos").select("*, clientes(nombre_completo)").order("placa"),

    sb.rpc("v10_catalogo_listar", { p_incluir_inactivos: true }),

  ]);

  estado.clientes = clientes || [];

  estado.vehiculos = vehiculos || [];

  estado.catalogoMaestro = errorCatalogo ? [] : (catalogo || []);

  // Se conservan las propiedades antiguas vacias solo para evitar incompatibilidades con extensiones previas.

  estado.servicios = [];

  estado.categorias = estado.catalogoMaestro.filter(x => x.tipo === "CATEGORIA");

  llenarSelect("cliente", "vehiculo-cliente");

  llenarSelectCategorias();

}

function llenarSelect(tipo, idSelect) {

  const sel = el(idSelect); if (!sel) return;

  const lista = tipo === "cliente" ? estado.clientes : [];

  sel.innerHTML = `<option value="">Selecciona…</option>` + lista.map(c => { const extra = c.telefono || c.rfc || c.correo || "sin contacto"; return `<option value="${c.id}">${c.nombre_completo} — ${extra}</option>`; }).join("");

}

function llenarSelectCategorias() {

  const sel = el("servicio-categoria"); if (!sel) return;

  const cats = (estado.catalogoMaestro || []).filter(c => c.tipo === "CATEGORIA" && c.activo);

  sel.innerHTML = `<option value="">Selecciona...</option>` + cats.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join("");

}



// ============================================================================

// INICIO / DASHBOARD

// ============================================================================

async function cargarInicio() {

  const { data: cots } = await sb.from("cotizaciones").select("*, clientes(nombre_completo), vehiculos(placa)").order("created_at", { ascending: false }).limit(300);

  const lista = cots || [];

  const ids = lista.map(c => c.id);

  let pagosPorCot = {};

  if (ids.length) {

    const { data: pagos } = await sb.from("pagos").select("cotizacion_id, importe").in("cotizacion_id", ids).eq("estado", "valido");

    (pagos || []).forEach(p => { pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id] || 0) + Number(p.importe); });

  }

  const abiertas = lista.filter(c => !["cerrada","cancelada","rechazada"].includes(c.estado_comercial));

  const pendientes = lista.filter(c => c.estado_comercial === "pendiente_autorizacion");

  const enProceso = lista.filter(c => c.estado_servicio === "en_proceso");

  const conSaldo = lista.filter(c => Number(c.total||0) - (pagosPorCot[c.id]||0) > 0);

  const kpis = el("kpis-inicio").querySelectorAll(".valor");

  kpis[0].textContent = abiertas.length; kpis[1].textContent = pendientes.length; kpis[2].textContent = enProceso.length; kpis[3].textContent = conSaldo.length;

  el("tabla-actividad-reciente").innerHTML = lista.slice(0,12).map(c => { const saldo = Math.max(0, Number(c.total||0) - (pagosPorCot[c.id]||0)); return `<tr><td>${c.folio}</td><td>${c.vehiculos?c.vehiculos.placa:"—"}</td><td>${c.clientes?c.clientes.nombre_completo:"—"}</td><td>$${money(c.total)}</td><td>${badgeComercial(c.estado_comercial)}${saldo>0?` <span class="badge rojo">Debe $${money(saldo)}</span>`:""}</td><td>${c.fecha||""}</td></tr>`; }).join("") || `<tr><td colspan="6" class="vacio-tabla">Sin cotizaciones todavía.</td></tr>`;

}



// ============================================================================

// CLIENTES

// ============================================================================

async function cargarClientes(filtro = "") {

  const { data } = await sb.from("clientes").select("*, vehiculos(id)").order("nombre_completo");

  let lista = data || [];

  if (filtro) { const f = filtro.toLowerCase(); lista = lista.filter(c => (c.nombre_completo||"").toLowerCase().includes(f) || (c.telefono||"").includes(f) || (c.correo||"").toLowerCase().includes(f)); }

  el("tabla-clientes").innerHTML = lista.length ? lista.map(c => `<tr><td>${c.nombre_completo}</td><td>${c.telefono||"—"}</td><td>${c.correo||"—"}</td><td>${(c.vehiculos||[]).length}</td><td>${puedeEscribir()?`<button class="btn secundario pequeno" data-editar-cliente="${c.id}">Editar</button>`:""}</td></tr>`).join("") : `<tr><td colspan="5" class="vacio-tabla">Sin clientes registrados.</td></tr>`;

  document.querySelectorAll("[data-editar-cliente]").forEach(b => b.addEventListener("click", () => abrirModalCliente(lista.find(c => c.id === b.dataset.editarCliente))));

}

el("buscar-cliente").addEventListener("input", (e) => cargarClientes(e.target.value));

el("btn-nuevo-cliente").addEventListener("click", () => abrirModalCliente(null));

function abrirModalCliente(c) {

  el("titulo-modal-cliente").textContent = c ? "Editar cliente" : "Nuevo cliente";

  el("cliente-id").value = c ? c.id : "";

  el("cliente-nombre").value = c ? c.nombre_completo : "";

  el("cliente-telefono").value = c ? c.telefono || "" : "";

  el("cliente-correo").value = c ? c.correo || "" : "";

  el("cliente-rfc").value = c ? c.rfc || "" : "";

  el("cliente-direccion").value = c ? c.direccion || "" : "";

  el("cliente-observaciones").value = c ? c.observaciones || "" : "";

  abrirModal("modal-cliente");

}

el("form-cliente").addEventListener("submit", async (ev) => {

  ev.preventDefault();

  const id = el("cliente-id").value;

  const telNuevo = el("cliente-telefono").value.trim();

  const registro = { nombre_completo: el("cliente-nombre").value.trim(), telefono: telNuevo || null, correo: el("cliente-correo").value.trim() || null, rfc: el("cliente-rfc").value.trim() || null, direccion: el("cliente-direccion").value.trim() || null, observaciones: el("cliente-observaciones").value.trim() || null };

  let error, data;

  if (id) {

    const anterior = estado.clientes.find(c => c.id === id);

    ({ data, error } = await sb.from("clientes").update(registro).eq("id", id).select().single());

    if (!error && anterior && (anterior.telefono || "") !== (telNuevo || "") && telNuevo) await sb.rpc("cambiar_telefono", { p_cliente_id: id, p_nuevo_tel: telNuevo });

    if (!error) await registrarBitacora("clientes", id, "actualizar", null, registro);

  } else {

    registro.created_by = estado.usuario.id;

    ({ data, error } = await sb.from("clientes").insert(registro).select().single());

    if (!error) await registrarBitacora("clientes", data.id, "crear", null, registro);

  }

  if (error) { mostrarMensaje("mensaje-cliente", "Error al guardar: " + error.message, "error"); return; }

  cerrarModal("modal-cliente"); await cargarDatosBase(); cargarClientes();

});



// ============================================================================

// VEHÍCULOS + cascada de catálogo de autos

// ============================================================================

function normalizarPlaca(p){ return (p||"").toUpperCase().replace(/[\s-]/g,""); }

async function cargarVehiculos(filtro = "") {

  const { data } = await sb.from("vehiculos").select("*, clientes(nombre_completo)").order("placa");

  let lista = data || [];

  if (filtro) lista = lista.filter(v => normalizarPlaca(v.placa).includes(normalizarPlaca(filtro)) || (v.vin||"").toLowerCase().includes(filtro.toLowerCase()) || (v.marca||"").toLowerCase().includes(filtro.toLowerCase()) || (v.modelo||"").toLowerCase().includes(filtro.toLowerCase()));

  el("tabla-vehiculos").innerHTML = lista.length ? lista.map(v => `<tr><td>${v.placa}</td><td>${v.vin?v.vin.slice(-8):"—"}</td><td>${v.marca} ${v.modelo}</td><td>${v.anio||"—"}</td><td>${v.clientes?v.clientes.nombre_completo:"—"}</td><td>${v.kilometraje_actual!=null?v.kilometraje_actual.toLocaleString("es-MX"):"—"}</td><td><button class="btn secundario pequeno" data-historial="${v.id}">Historial</button>${puedeEscribir()?` <button class="btn secundario pequeno" data-editar-vehiculo="${v.id}">Editar</button>`:""}</td></tr>`).join("") : `<tr><td colspan="7" class="vacio-tabla">Sin vehículos registrados.</td></tr>`;

  document.querySelectorAll("[data-editar-vehiculo]").forEach(b => b.addEventListener("click", () => abrirModalVehiculo(lista.find(v => v.id === b.dataset.editarVehiculo))));

  document.querySelectorAll("[data-historial]").forEach(b => b.addEventListener("click", () => verHistorialVehiculo(b.dataset.historial)));

}

el("buscar-vehiculo").addEventListener("input", (e) => cargarVehiculos(e.target.value));

el("btn-nuevo-vehiculo").addEventListener("click", () => abrirModalVehiculo(null));

function abrirModalVehiculo(v) {

  el("titulo-modal-vehiculo").textContent = v ? "Editar vehículo" : "Nuevo vehículo";

  el("vehiculo-id").value = v ? v.id : "";

  el("vehiculo-cliente").value = v ? v.cliente_id : "";

  el("vehiculo-vin").value = v ? v.vin || "" : "";

  el("vehiculo-placa").value = v ? v.placa : "";

  el("vehiculo-marca").value = v ? v.marca : "";

  el("vehiculo-modelo").value = v ? v.modelo : "";

  el("vehiculo-anio").value = v ? v.anio || "" : "";

  el("vehiculo-motor").value = v ? v.motor || "" : "";

  el("vehiculo-combustible").value = v ? v.combustible || "" : "";

  el("vehiculo-color").value = v ? v.color || "" : "";

  el("vehiculo-km").value = v ? v.kilometraje_actual || "" : "";

  cargarAniosCatalogo();

  if (el("cat-manual")) el("cat-manual").checked = false;

  abrirModal("modal-vehiculo");

}

el("form-vehiculo").addEventListener("submit", async (ev) => {

  ev.preventDefault();

  const id = el("vehiculo-id").value;

  const placaNueva = el("vehiculo-placa").value.trim().toUpperCase();

  const registro = { cliente_id: el("vehiculo-cliente").value, vin: el("vehiculo-vin").value.trim().toUpperCase() || null, placa: placaNueva, marca: el("vehiculo-marca").value.trim(), modelo: el("vehiculo-modelo").value.trim(), anio: el("vehiculo-anio").value ? Number(el("vehiculo-anio").value) : null, motor: el("vehiculo-motor").value.trim() || null, combustible: el("vehiculo-combustible").value.trim() || null, color: el("vehiculo-color").value.trim() || null, kilometraje_actual: el("vehiculo-km").value ? Number(el("vehiculo-km").value) : null };

  let error, data;

  if (id) {

    const anterior = estado.vehiculos.find(v => v.id === id);

    ({ data, error } = await sb.from("vehiculos").update(registro).eq("id", id).select().single());

    if (!error && anterior && (anterior.placa || "") !== placaNueva && placaNueva) await sb.rpc("cambiar_placa", { p_vehiculo_id: id, p_nueva_placa: placaNueva, p_nota: "Cambio desde ficha" });

    if (!error) await registrarBitacora("vehiculos", id, "actualizar", null, registro);

  } else {

    registro.created_by = estado.usuario.id;

    ({ data, error } = await sb.from("vehiculos").insert(registro).select().single());

    if (!error) await registrarBitacora("vehiculos", data.id, "crear", null, registro);

  }

  if (error) { mostrarMensaje("mensaje-vehiculo", "Error al guardar: " + error.message, "error"); return; }

  if (el("cat-manual") && el("cat-manual").checked && registro.marca && registro.modelo && registro.anio) await sb.rpc("agregar_auto_catalogo", { p_anio: registro.anio, p_marca: registro.marca, p_modelo: registro.modelo, p_version: null, p_motor: registro.motor || null });

  cerrarModal("modal-vehiculo"); await cargarDatosBase(); cargarVehiculos();

});

async function cargarAniosCatalogo() {

  if (!el("cat-anio")) return;

  const { data } = await sb.rpc("autos_anios");

  el("cat-anio").innerHTML = `<option value="">—</option>` + (data||[]).map(a=>`<option value="${a}">${a}</option>`).join("");

  ["cat-marca","cat-modelo","cat-version","cat-motor"].forEach(i=>{ if(el(i)) el(i).innerHTML=`<option value="">—</option>`; });

}

function sincronizarVehiculoDesdeCatalogo() { el("vehiculo-anio").value = el("cat-anio").value || ""; el("vehiculo-marca").value = el("cat-marca").value || ""; el("vehiculo-modelo").value = el("cat-modelo").value || ""; el("vehiculo-motor").value = el("cat-motor").value || ""; }

el("cat-anio")?.addEventListener("change", async () => {

  ["cat-marca","cat-modelo","cat-version","cat-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);

  if (!el("cat-anio").value) return;

  const { data } = await sb.rpc("autos_marcas", { p_anio: Number(el("cat-anio").value) });

  el("cat-marca").innerHTML = `<option value="">—</option>` + (data||[]).map(m=>`<option>${m}</option>`).join("");

});

el("cat-marca")?.addEventListener("change", async () => {

  ["cat-modelo","cat-version","cat-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);

  if (!el("cat-marca").value) return;

  const { data } = await sb.rpc("autos_modelos", { p_anio: Number(el("cat-anio").value), p_marca: el("cat-marca").value });

  el("cat-modelo").innerHTML = `<option value="">—</option>` + (data||[]).map(m=>`<option>${m}</option>`).join("");

});

el("cat-modelo")?.addEventListener("change", async () => {

  ["cat-version","cat-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);

  if (!el("cat-modelo").value) return;

  sincronizarVehiculoDesdeCatalogo();

  const base = { p_anio: Number(el("cat-anio").value), p_marca: el("cat-marca").value, p_modelo: el("cat-modelo").value };

  const { data: vers } = await sb.rpc("autos_versiones", base);

  el("cat-version").innerHTML = `<option value="">—</option>` + (vers||[]).map(v=>`<option>${v}</option>`).join("");

  const { data: mot } = await sb.rpc("autos_motores", { ...base, p_version: "" });

  el("cat-motor").innerHTML = `<option value="">—</option>` + (mot||[]).map(m=>`<option>${m}</option>`).join("");

});

el("cat-version")?.addEventListener("change", sincronizarVehiculoDesdeCatalogo);

el("cat-motor")?.addEventListener("change", sincronizarVehiculoDesdeCatalogo);



async function verHistorialVehiculo(vehiculoId) {

  const v = estado.vehiculos.find(x => x.id === vehiculoId);

  el("titulo-historial").textContent = `Historial de ${v ? v.placa : ""}`;

  el("subtitulo-historial").textContent = v ? `${v.marca} ${v.modelo} ${v.anio||""} · ${v.vin?"VIN "+v.vin+" · ":""}Cliente: ${v.clientes?v.clientes.nombre_completo:"—"}` : "";

  const { data: cots } = await sb.from("cotizaciones").select("*").eq("vehiculo_id", vehiculoId).order("fecha", { ascending: false });

  const lista = cots || [];

  const ids = lista.map(c => c.id);

  let pagosPorCot = {}, seguimientos = [];

  if (ids.length) {

    const [{ data: pagos }, { data: segs }] = await Promise.all([ sb.from("pagos").select("*").in("cotizacion_id", ids).eq("estado","valido"), sb.from("seguimientos").select("*").in("cotizacion_id", ids).order("created_at", { ascending: false }) ]);

    (pagos||[]).forEach(p => { pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id]||0) + Number(p.importe); });

    seguimientos = segs || [];

  }

  const totalFact = lista.reduce((s,c)=>s+Number(c.total||0),0);

  const saldoAcum = lista.reduce((s,c)=>s+Math.max(0,Number(c.total||0)-(pagosPorCot[c.id]||0)),0);

  const k = el("kpis-historial").querySelectorAll(".valor");

  k[0].textContent = lista.length; k[1].textContent = "$"+money(totalFact); k[2].textContent = "$"+money(saldoAcum);

  el("tabla-historial-cotizaciones").innerHTML = lista.length ? lista.map(c => { const saldo = Math.max(0, Number(c.total||0)-(pagosPorCot[c.id]||0)); return `<tr><td>${c.folio}</td><td>${c.fecha||"—"}</td><td>${c.kilometraje_visita!=null?c.kilometraje_visita.toLocaleString("es-MX"):"—"}</td><td>$${money(c.total)}</td><td>$${money(saldo)}</td><td>${badgeComercial(c.estado_comercial)}</td><td><button class="btn secundario pequeno" data-abrir-desde-historial="${c.id}">Abrir</button></td></tr>`; }).join("") : `<tr><td colspan="7" class="vacio-tabla">Este vehículo no tiene cotizaciones.</td></tr>`;

  document.querySelectorAll("[data-abrir-desde-historial]").forEach(b => b.addEventListener("click", () => { cerrarModal("modal-historial"); abrirCotizacion(b.dataset.abrirDesdeHistorial); }));

  const { data: placas } = await sb.from("placas_historial").select("*").eq("vehiculo_id", vehiculoId).order("desde", { ascending: false });

  el("lista-historial-placas").innerHTML = (placas||[]).length ? (placas||[]).map(p => `<li><strong>${p.placa}</strong> ${p.vigente?'<span class="badge verde">Vigente</span>':'<span class="badge gris">Anterior</span>'}<br><small>Desde ${p.desde}${p.hasta?" hasta "+p.hasta:""}</small></li>`).join("") : `<li>Sin registro de placas.</li>`;

  el("lista-historial-seguimiento").innerHTML = seguimientos.length ? seguimientos.map(s => { const cot = lista.find(c => c.id === s.cotizacion_id); return `<li><strong>${cot?cot.folio:""}</strong> · ${s.descripcion}<br><small>${new Date(s.created_at).toLocaleString("es-MX")}</small></li>`; }).join("") : `<li>Sin movimientos de seguimiento.</li>`;

  abrirModal("modal-historial");

}



// ============================================================================

// CATÁLOGO MAESTRO V10

// ============================================================================

const ETIQUETAS_TIPO_CATALOGO = {

  CONCEPTO_SERVICIO: "Servicio",

  CONCEPTO_MANO_OBRA: "Mano de obra",

  CONCEPTO_REFACCION: "Refacción / consumible",

  COMBO: "Combo / paquete"

};

function nombreCategoriaCatalogo(codigo) {

  const cat = (estado.catalogoMaestro || []).find(x => x.tipo === "CATEGORIA" && x.codigo === codigo);

  return cat ? cat.nombre : (codigo || "—");

}

async function cargarCatalogo(filtro = "") {

  const tipo = el("filtro-catalogo-tipo")?.value || "";

  const categoria = el("filtro-catalogo-categoria")?.value || "";

  const estadoFiltro = el("filtro-catalogo-estado")?.value || "";

  const { data, error } = await sb.rpc("v10_catalogo_listar", { p_incluir_inactivos: true });

  if (error) {

    el("tabla-catalogo").innerHTML = `<tr><td colspan="6" class="vacio-tabla">Error al cargar Catálogo Maestro: ${error.message}</td></tr>`;

    return;

  }

  estado.catalogoMaestro = data || [];

  llenarSelectCategorias();

  llenarFiltrosCatalogo();

  let lista = estado.catalogoMaestro.filter(x => ["CONCEPTO_SERVICIO","CONCEPTO_MANO_OBRA","CONCEPTO_REFACCION","COMBO"].includes(x.tipo));

  if (filtro) { const f = filtro.toLowerCase(); lista = lista.filter(s => (s.codigo||"").toLowerCase().includes(f) || (s.nombre||"").toLowerCase().includes(f)); }

  if (tipo) lista = lista.filter(s => s.tipo === tipo);

  if (categoria) lista = lista.filter(s => s.categoria_codigo === categoria);

  if (estadoFiltro) lista = lista.filter(s => (s.activo ? "activo" : "inactivo") === estadoFiltro);

  el("tabla-catalogo").innerHTML = lista.length ? lista.map(s => `<tr>

    <td>${s.codigo}</td><td>${s.nombre}</td><td>${ETIQUETAS_TIPO_CATALOGO[s.tipo] || s.tipo}</td>

    <td>${s.tipo === "COMBO" ? "Combos / paquetes" : nombreCategoriaCatalogo(s.categoria_codigo)}</td>

    <td><span class="badge ${s.activo ? "verde" : "gris"}">${s.activo ? "Activo" : "Inactivo"}</span></td>

    <td>${puedeEscribir() && s.tipo !== "COMBO" ? `<button class="btn secundario pequeno" data-editar-servicio="${s.codigo}">Editar</button>` : ""}</td>

  </tr>`).join("") : `<tr><td colspan="6" class="vacio-tabla">Catálogo vacío.</td></tr>`;

  document.querySelectorAll("[data-editar-servicio]").forEach(b => b.addEventListener("click", () => abrirModalServicio(lista.find(s => s.codigo === b.dataset.editarServicio))));

}

function llenarFiltrosCatalogo() {

  const sel = el("filtro-catalogo-categoria");

  if (!sel) return;

  const actual = sel.value;

  const cats = (estado.catalogoMaestro || []).filter(x => x.tipo === "CATEGORIA" && x.activo);

  sel.innerHTML = `<option value="">Categoría: todas</option>` + cats.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join("");

  sel.value = actual;

}

el("buscar-servicio").addEventListener("input", e => cargarCatalogo(e.target.value));

el("filtro-catalogo-tipo")?.addEventListener("change", () => cargarCatalogo(el("buscar-servicio").value));

el("filtro-catalogo-categoria")?.addEventListener("change", () => cargarCatalogo(el("buscar-servicio").value));

el("filtro-catalogo-estado")?.addEventListener("change", () => cargarCatalogo(el("buscar-servicio").value));

el("btn-nuevo-servicio").addEventListener("click", () => abrirModalServicio(null));

function abrirModalServicio(s) {

  el("titulo-modal-servicio").textContent = s ? "Editar concepto" : "Nuevo concepto";

  el("servicio-id").value = s ? s.codigo : "";

  el("servicio-codigo").value = s ? s.codigo : "";

  el("servicio-codigo").readOnly = !!s;

  el("servicio-nombre").value = s ? s.nombre : "";

  el("servicio-tipo").value = s ? s.tipo : "CONCEPTO_SERVICIO";

  el("servicio-categoria").value = s ? (s.categoria_codigo || "") : "";

  el("servicio-estado").value = s && !s.activo ? "inactivo" : "activo";

  el("servicio-descripcion").value = s ? (s.nombre || "") : "";

  abrirModal("modal-servicio");

}

el("form-servicio").addEventListener("submit", async ev => {

  ev.preventDefault();

  if (!esAdmin()) { mostrarMensaje("mensaje-servicio", "Solo un administrador puede modificar el catálogo.", "error"); return; }

  const codigoOriginal = el("servicio-id").value || null;

  const registro = {

    p_codigo_original: codigoOriginal,

    p_codigo: el("servicio-codigo").value.trim().toUpperCase(),

    p_nombre: el("servicio-nombre").value.trim(),

    p_tipo: el("servicio-tipo").value,

    p_categoria_codigo: el("servicio-categoria").value || null,

    p_activo: el("servicio-estado").value === "activo"

  };

  const { data, error } = await sb.rpc("v10_catalogo_guardar", registro);

  if (error) { mostrarMensaje("mensaje-servicio", "Error al guardar: " + error.message, "error"); return; }

  await registrarBitacora("catalogo_maestro", null, codigoOriginal ? "actualizar" : "crear", null, registro);

  cerrarModal("modal-servicio");

  await cargarDatosBase();

  cargarCatalogo();

});

// ============================================================================

// COTIZACIONES (lista + filtros)

// ============================================================================

async function cargarCotizaciones() {

  const { data } = await sb.from("cotizaciones").select("*, clientes(nombre_completo), vehiculos(placa, marca, modelo)").order("created_at", { ascending: false });

  const cots = data || [];

  const ids = cots.map(c => c.id);

  let pagosPorCot = {};

  if (ids.length) { const { data: pagos } = await sb.from("pagos").select("cotizacion_id, importe").in("cotizacion_id", ids).eq("estado", "valido"); (pagos||[]).forEach(p => { pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id]||0) + Number(p.importe); }); }

  cots.forEach(c => { c._saldo = Math.max(0, Number(c.total||0) - (pagosPorCot[c.id]||0)); });

  aplicarFiltrosCotizaciones(cots);

}

function aplicarFiltrosCotizaciones(listaCompleta) {

  const texto = el("buscar-cotizacion").value.toLowerCase();

  const estadoF = el("filtro-estado-comercial").value;

  const pagoF = el("filtro-estado-pago") ? el("filtro-estado-pago").value : "";

  let lista = listaCompleta;

  if (texto) lista = lista.filter(c => c.folio.toLowerCase().includes(texto) || (c.vehiculos && c.vehiculos.placa.toLowerCase().includes(texto)) || (c.clientes && c.clientes.nombre_completo.toLowerCase().includes(texto)));

  if (estadoF) lista = lista.filter(c => c.estado_comercial === estadoF);

  if (pagoF === "con_saldo") lista = lista.filter(c => (c._saldo||0) > 0);

  if (pagoF === "pagada") lista = lista.filter(c => (c._saldo||0) <= 0 && Number(c.total) > 0);

  el("tabla-cotizaciones").innerHTML = lista.length ? lista.map(c => `<tr><td>${c.folio}</td><td>${c.clientes?c.clientes.nombre_completo:"—"}</td><td>${c.vehiculos?c.vehiculos.placa+" · "+c.vehiculos.marca+" "+c.vehiculos.modelo:"—"}</td><td>$${money(c.total)}</td><td>${c._saldo>0?`<span class="badge rojo">$${money(c._saldo)}</span>`:`<span class="badge verde">Pagada</span>`}</td><td>${badgeComercial(c.estado_comercial)}</td><td>${badgeServicio(c.estado_servicio)}</td><td><button class="btn secundario pequeno" data-abrir-cotizacion="${c.id}">Abrir</button></td></tr>`).join("") : `<tr><td colspan="8" class="vacio-tabla">Todavía no hay cotizaciones.</td></tr>`;

  document.querySelectorAll("[data-abrir-cotizacion]").forEach(b => b.addEventListener("click", () => abrirCotizacion(b.dataset.abrirCotizacion)));

  window.__cotizacionesCache = listaCompleta;

}

el("buscar-cotizacion").addEventListener("input", () => aplicarFiltrosCotizaciones(window.__cotizacionesCache || []));

el("filtro-estado-comercial").addEventListener("change", () => aplicarFiltrosCotizaciones(window.__cotizacionesCache || []));

el("filtro-estado-pago")?.addEventListener("change", () => aplicarFiltrosCotizaciones(window.__cotizacionesCache || []));



// Pestañas del modal (recalcula gate)

document.querySelectorAll(".pestana").forEach(p => p.addEventListener("click", () => {

  document.querySelectorAll(".pestana").forEach(x => x.classList.remove("activa"));

  p.classList.add("activa");

  ["datos","pagos","seguimiento","archivos"].forEach(n => el("pestana-"+n).style.display = n === p.dataset.pestana ? "block" : "none");

  actualizarGatePagos();

}));

el("btn-nueva-cotizacion").addEventListener("click", () => abrirCotizacion(null));



// GATE: Pagos/Seguimiento/Archivos requieren cotización guardada

function actualizarGatePagos() {

  const hay = !!(el("cotizacion-id") && el("cotizacion-id").value);

  const secciones = [

    { pestana:"pestana-pagos", boton:"btn-agregar-pago", texto:"Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para poder registrar pagos." },

    { pestana:"pestana-seguimiento", boton:"btn-agregar-seguimiento", texto:"Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para agregar seguimiento." },

    { pestana:"pestana-archivos", boton:"btn-subir-archivo", texto:"Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para subir archivos." },

  ];

  secciones.forEach(s => {

    const cont = el(s.pestana);

    if (cont) { let b = cont.querySelector(".aviso-guardar"); if (!b) { b = document.createElement("div"); b.className = "aviso-guardar"; cont.insertBefore(b, cont.firstChild); } b.innerHTML = `⚠️ ${s.texto}`; b.style.display = hay ? "none" : "flex"; }

    const boton = el(s.boton);

    if (boton) { boton.disabled = !hay; boton.classList.toggle("btn-bloqueado", !hay); boton.title = hay ? "" : "Primero guarda la cotización"; }

  });

}



// ============================================================================

// V6 · CLIENTE Y VEHÍCULO INLINE

// ============================================================================

document.querySelectorAll('input[name="modo-cliente"]').forEach(r 

