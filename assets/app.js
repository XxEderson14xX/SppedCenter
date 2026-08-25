// ============================================================================
// Sistema Taller Automotriz · app.js · Versión V6
// Captura inline de cliente/vehículo desde la cotización + identidad permanente
// (VIN para autos, id interno para clientes). Incluye correcciones V5 y el
// "gate" de pestañas (Pagos/Seguimiento/Archivos) que exige guardar primero.
// ============================================================================
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const estado = {
  usuario: null, perfil: null,
  clientes: [], vehiculos: [], servicios: [], categorias: [],
  cotizacionActualId: null, conceptosEnEdicion: [],
};
// Selección inline de la cotización (V6)
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
    await sb.from("bitacora").insert({
      tabla_afectada: tabla, registro_id: registroId, accion,
      valores_anteriores: anteriores || null, valores_nuevos: nuevos || null,
      usuario_id: estado.usuario ? estado.usuario.id : null,
    });
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
async function verificarSesion() {
  const { data } = await sb.auth.getSession();
  if (data.session) await iniciarSesionExitosa(data.session);
}
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
  const [{ data: clientes }, { data: vehiculos }, { data: servicios }, { data: categorias }] = await Promise.all([
    sb.from("clientes").select("*").order("nombre_completo"),
    sb.from("vehiculos").select("*, clientes(nombre_completo)").order("placa"),
    sb.from("servicios").select("*").order("nombre"),
    sb.from("categorias").select("*").order("nombre"),
  ]);
  estado.clientes = clientes || [];
  estado.vehiculos = vehiculos || [];
  estado.servicios = servicios || [];
  estado.categorias = categorias || [];
  llenarSelect("cliente", "vehiculo-cliente");
  llenarSelectCategorias();
}
function llenarSelect(tipo, idSelect) {
  const sel = el(idSelect); if (!sel) return;
  const lista = tipo === "cliente" ? estado.clientes : [];
  sel.innerHTML = `<option value="">Selecciona…</option>` + lista.map(c => {
    const extra = c.telefono || c.rfc || c.correo || "sin contacto";
    return `<option value="${c.id}">${c.nombre_completo} — ${extra}</option>`;
  }).join("");
}
function llenarSelectCategorias() {
  const sel = el("servicio-categoria"); if (!sel) return;
  sel.innerHTML = `<option value="">Sin categoría</option>` + estado.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
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
  kpis[0].textContent = abiertas.length; kpis[1].textContent = pendientes.length;
  kpis[2].textContent = enProceso.length; kpis[3].textContent = conSaldo.length;
  el("tabla-actividad-reciente").innerHTML = lista.slice(0,12).map(c => {
    const saldo = Math.max(0, Number(c.total||0) - (pagosPorCot[c.id]||0));
    return `<tr><td>${c.folio}</td><td>${c.vehiculos?c.vehiculos.placa:"—"}</td><td>${c.clientes?c.clientes.nombre_completo:"—"}</td><td>$${money(c.total)}</td><td>${badgeComercial(c.estado_comercial)}${saldo>0?` <span class="badge rojo">Debe $${money(saldo)}</span>`:""}</td><td>${c.fecha||""}</td></tr>`;
  }).join("") || `<tr><td colspan="6" class="vacio-tabla">Sin cotizaciones todavía.</td></tr>`;
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
  const registro = {
    nombre_completo: el("cliente-nombre").value.trim(),
    telefono: telNuevo || null,
    correo: el("cliente-correo").value.trim() || null,
    rfc: el("cliente-rfc").value.trim() || null,
    direccion: el("cliente-direccion").value.trim() || null,
    observaciones: el("cliente-observaciones").value.trim() || null,
  };
  let error, data;
  if (id) {
    // Si cambió el teléfono, usar la función que guarda historial (V6)
    const anterior = estado.clientes.find(c => c.id === id);
    ({ data, error } = await sb.from("clientes").update(registro).eq("id", id).select().single());
    if (!error && anterior && (anterior.telefono || "") !== (telNuevo || "") && telNuevo) {
      await sb.rpc("cambiar_telefono", { p_cliente_id: id, p_nuevo_tel: telNuevo });
    }
    if (!error) await registrarBitacora("clientes", id, "actualizar", null, registro);
  } else {
    registro.created_by = estado.usuario.id;
    ({ data, error } = await sb.from("clientes").insert(registro).select().single());
    if (!error) await registrarBitacora("clientes", data.id, "crear", null, registro);
  }
  if (error) { mostrarMensaje("mensaje-cliente", "Error al guardar: " + error.message, "error"); return; }
  cerrarModal("modal-cliente");
  await cargarDatosBase();
  cargarClientes();
});

// ============================================================================
// VEHÍCULOS (módulo) + cascada de catálogo
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
  const registro = {
    cliente_id: el("vehiculo-cliente").value,
    vin: el("vehiculo-vin").value.trim().toUpperCase() || null,
    placa: placaNueva,
    marca: el("vehiculo-marca").value.trim(),
    modelo: el("vehiculo-modelo").value.trim(),
    anio: el("vehiculo-anio").value ? Number(el("vehiculo-anio").value) : null,
    motor: el("vehiculo-motor").value.trim() || null,
    combustible: el("vehiculo-combustible").value.trim() || null,
    color: el("vehiculo-color").value.trim() || null,
    kilometraje_actual: el("vehiculo-km").value ? Number(el("vehiculo-km").value) : null,
  };
  let error, data;
  if (id) {
    const anterior = estado.vehiculos.find(v => v.id === id);
    ({ data, error } = await sb.from("vehiculos").update(registro).eq("id", id).select().single());
    if (!error && anterior && (anterior.placa || "") !== placaNueva && placaNueva) {
      await sb.rpc("cambiar_placa", { p_vehiculo_id: id, p_nueva_placa: placaNueva, p_nota: "Cambio desde ficha" });
    }
    if (!error) await registrarBitacora("vehiculos", id, "actualizar", null, registro);
  } else {
    registro.created_by = estado.usuario.id;
    ({ data, error } = await sb.from("vehiculos").insert(registro).select().single());
    if (!error) await registrarBitacora("vehiculos", data.id, "crear", null, registro);
  }
  if (error) { mostrarMensaje("mensaje-vehiculo", "Error al guardar: " + error.message, "error"); return; }
  if (el("cat-manual") && el("cat-manual").checked && registro.marca && registro.modelo && registro.anio) {
    await sb.rpc("agregar_auto_catalogo", { p_anio: registro.anio, p_marca: registro.marca, p_modelo: registro.modelo, p_version: null, p_motor: registro.motor || null });
  }
  cerrarModal("modal-vehiculo");
  await cargarDatosBase();
  cargarVehiculos();
});

// --- Cascada del modal de vehículo ---
async function cargarAniosCatalogo() {
  if (!el("cat-anio")) return;
  const { data } = await sb.rpc("autos_anios");
  el("cat-anio").innerHTML = `<option value="">—</option>` + (data||[]).map(a=>`<option value="${a}">${a}</option>`).join("");
  ["cat-marca","cat-modelo","cat-version","cat-motor"].forEach(i=>{ if(el(i)) el(i).innerHTML=`<option value="">—</option>`; });
}
function sincronizarVehiculoDesdeCatalogo() {
  el("vehiculo-anio").value = el("cat-anio").value || "";
  el("vehiculo-marca").value = el("cat-marca").value || "";
  el("vehiculo-modelo").value = el("cat-modelo").value || "";
  el("vehiculo-motor").value = el("cat-motor").value || "";
}
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
    const [{ data: pagos }, { data: segs }] = await Promise.all([
      sb.from("pagos").select("*").in("cotizacion_id", ids).eq("estado","valido"),
      sb.from("seguimientos").select("*").in("cotizacion_id", ids).order("created_at", { ascending: false }),
    ]);
    (pagos||[]).forEach(p => { pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id]||0) + Number(p.importe); });
    seguimientos = segs || [];
  }
  const totalFact = lista.reduce((s,c)=>s+Number(c.total||0),0);
  const saldoAcum = lista.reduce((s,c)=>s+Math.max(0,Number(c.total||0)-(pagosPorCot[c.id]||0)),0);
  const k = el("kpis-historial").querySelectorAll(".valor");
  k[0].textContent = lista.length; k[1].textContent = "$"+money(totalFact); k[2].textContent = "$"+money(saldoAcum);
  el("tabla-historial-cotizaciones").innerHTML = lista.length ? lista.map(c => {
    const saldo = Math.max(0, Number(c.total||0)-(pagosPorCot[c.id]||0));
    return `<tr><td>${c.folio}</td><td>${c.fecha||"—"}</td><td>${c.kilometraje_visita!=null?c.kilometraje_visita.toLocaleString("es-MX"):"—"}</td><td>$${money(c.total)}</td><td>$${money(saldo)}</td><td>${badgeComercial(c.estado_comercial)}</td><td><button class="btn secundario pequeno" data-abrir-desde-historial="${c.id}">Abrir</button></td></tr>`;
  }).join("") : `<tr><td colspan="7" class="vacio-tabla">Este vehículo no tiene cotizaciones.</td></tr>`;
  document.querySelectorAll("[data-abrir-desde-historial]").forEach(b => b.addEventListener("click", () => { cerrarModal("modal-historial"); abrirCotizacion(b.dataset.abrirDesdeHistorial); }));
  // Historial de placas del auto (V6)
  const { data: placas } = await sb.from("placas_historial").select("*").eq("vehiculo_id", vehiculoId).order("desde", { ascending: false });
  el("lista-historial-placas").innerHTML = (placas||[]).length ? (placas||[]).map(p => `<li><strong>${p.placa}</strong> ${p.vigente?'<span class="badge verde">Vigente</span>':'<span class="badge gris">Anterior</span>'}<br><small>Desde ${p.desde}${p.hasta?" hasta "+p.hasta:""}</small></li>`).join("") : `<li>Sin registro de placas.</li>`;
  el("lista-historial-seguimiento").innerHTML = seguimientos.length ? seguimientos.map(s => { const cot = lista.find(c => c.id === s.cotizacion_id); return `<li><strong>${cot?cot.folio:""}</strong> · ${s.descripcion}<br><small>${new Date(s.created_at).toLocaleString("es-MX")}</small></li>`; }).join("") : `<li>Sin movimientos de seguimiento.</li>`;
  abrirModal("modal-historial");
}

// ============================================================================
// CATÁLOGO DE SERVICIOS
// ============================================================================
async function cargarCatalogo(filtro = "") {
  const { data } = await sb.from("servicios").select("*, categorias(nombre)").order("nombre");
  let lista = data || [];
  if (filtro) { const f = filtro.toLowerCase(); lista = lista.filter(s => (s.codigo||"").toLowerCase().includes(f) || (s.nombre||"").toLowerCase().includes(f)); }
  el("tabla-catalogo").innerHTML = lista.length ? lista.map(s => `<tr><td>${s.codigo}</td><td>${s.nombre}</td><td>${s.categorias?s.categorias.nombre:"—"}</td><td>$${money(s.precio_venta)}</td><td>${s.estado}</td><td>${puedeEscribir()?`<button class="btn secundario pequeno" data-editar-servicio="${s.id}">Editar</button>`:""}</td></tr>`).join("") : `<tr><td colspan="6" class="vacio-tabla">Catálogo vacío.</td></tr>`;
  document.querySelectorAll("[data-editar-servicio]").forEach(b => b.addEventListener("click", () => abrirModalServicio(lista.find(s => s.id === b.dataset.editarServicio))));
}
el("buscar-servicio").addEventListener("input", (e) => cargarCatalogo(e.target.value));
el("btn-nuevo-servicio").addEventListener("click", () => abrirModalServicio(null));
function abrirModalServicio(s) {
  el("titulo-modal-servicio").textContent = s ? "Editar servicio" : "Nuevo servicio";
  el("servicio-id").value = s ? s.id : "";
  el("servicio-codigo").value = s ? s.codigo : "";
  el("servicio-nombre").value = s ? s.nombre : "";
  el("servicio-categoria").value = s ? s.categoria_id || "" : "";
  el("servicio-unidad").value = s ? s.unidad_medida : "servicio";
  el("servicio-precio").value = s ? s.precio_venta : "";
  el("servicio-costo").value = s ? s.costo_interno || "" : "";
  el("servicio-impuesto").value = s ? s.impuesto || 0 : 0;
  el("servicio-estado").value = s ? s.estado : "activo";
  el("servicio-descripcion").value = s ? s.descripcion || "" : "";
  abrirModal("modal-servicio");
}
el("form-servicio").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!esAdmin()) { mostrarMensaje("mensaje-servicio", "Solo un administrador puede modificar el catálogo.", "error"); return; }
  const id = el("servicio-id").value;
  const registro = {
    codigo: el("servicio-codigo").value.trim(), nombre: el("servicio-nombre").value.trim(),
    categoria_id: el("servicio-categoria").value || null, unidad_medida: el("servicio-unidad").value.trim() || "servicio",
    precio_venta: Number(el("servicio-precio").value || 0), costo_interno: el("servicio-costo").value ? Number(el("servicio-costo").value) : null,
    impuesto: Number(el("servicio-impuesto").value || 0), estado: el("servicio-estado").value, descripcion: el("servicio-descripcion").value.trim() || null,
  };
  let error;
  if (id) { ({ error } = await sb.from("servicios").update(registro).eq("id", id)); if (!error) await registrarBitacora("servicios", id, "actualizar", null, registro); }
  else { const { data, error: e2 } = await sb.from("servicios").insert(registro).select().single(); error = e2; if (!error) await registrarBitacora("servicios", data.id, "crear", null, registro); }
  if (error) { mostrarMensaje("mensaje-servicio", "Error al guardar: " + error.message, "error"); return; }
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
  if (ids.length) {
    const { data: pagos } = await sb.from("pagos").select("cotizacion_id, importe").in("cotizacion_id", ids).eq("estado", "valido");
    (pagos||[]).forEach(p => { pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id]||0) + Number(p.importe); });
  }
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

// --- Pestañas del modal (con recálculo del gate de guardado) ---
document.querySelectorAll(".pestana").forEach(p => p.addEventListener("click", () => {
  document.querySelectorAll(".pestana").forEach(x => x.classList.remove("activa"));
  p.classList.add("activa");
  ["datos","pagos","seguimiento","archivos"].forEach(n => el("pestana-"+n).style.display = n === p.dataset.pestana ? "block" : "none");
  actualizarGatePagos();
}));

el("btn-nueva-cotizacion").addEventListener("click", () => abrirCotizacion(null));

// --- GATE: Pagos/Seguimiento/Archivos requieren cotización ya guardada ---
// Muestra un aviso elegante y bloquea los botones hasta que exista la cotización.
function actualizarGatePagos() {
  const hayCotizacion = !!(el("cotizacion-id") && el("cotizacion-id").value);
  const secciones = [
    { pestana: "pestana-pagos",       boton: "btn-agregar-pago",       texto: "Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para poder registrar pagos." },
    { pestana: "pestana-seguimiento", boton: "btn-agregar-seguimiento", texto: "Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para agregar seguimiento." },
    { pestana: "pestana-archivos",    boton: "btn-subir-archivo",       texto: "Guarda la cotización en la pestaña <strong>Datos y conceptos</strong> para subir archivos." },
  ];
  secciones.forEach(s => {
    const cont = el(s.pestana);
    if (cont) {
      let banner = cont.querySelector(".aviso-guardar");
      if (!banner) { banner = document.createElement("div"); banner.className = "aviso-guardar"; cont.insertBefore(banner, cont.firstChild); }
      banner.innerHTML = `⚠️ ${s.texto}`;
      banner.style.display = hayCotizacion ? "none" : "flex";
    }
    const boton = el(s.boton);
    if (boton) {
      boton.disabled = !hayCotizacion;
      boton.classList.toggle("btn-bloqueado", !hayCotizacion);
      boton.title = hayCotizacion ? "" : "Primero guarda la cotización";
    }
  });
}

// ============================================================================
// V6 · CLIENTE Y VEHÍCULO INLINE (dentro de la cotización)
// ============================================================================
document.querySelectorAll('input[name="modo-cliente"]').forEach(r => r.addEventListener("change", () => {
  const nuevo = document.querySelector('input[name="modo-cliente"]:checked').value === "nuevo";
  el("cliente-modo-nuevo").style.display = nuevo ? "block" : "none";
  el("cliente-modo-existente").style.display = nuevo ? "none" : "block";
  if (nuevo) { seleccion.clienteId = null; refrescarAutosDelCliente(); }
}));

let _debCliente;
el("cliente-buscar").addEventListener("input", () => {
  clearTimeout(_debCliente);
  const texto = el("cliente-buscar").value.trim();
  const cont = el("cliente-sugerencias");
  if (texto.length < 2) { cont.classList.remove("activo"); cont.innerHTML = ""; return; }
  _debCliente = setTimeout(async () => {
    const { data } = await sb.rpc("buscar_clientes", { p_texto: texto });
    if (!data || !data.length) { cont.innerHTML = `<div class="sugerencia-item" style="color:var(--text-mute);">Sin coincidencias — usa "Cliente nuevo".</div>`; cont.classList.add("activo"); return; }
    cont.innerHTML = data.map(c => `<div class="sugerencia-item" data-cli="${c.id}" data-nombre="${c.nombre_completo}">${c.nombre_completo}<small>${c.telefono||"sin teléfono"} · ${c.correo||"sin correo"} · ${c.autos} auto(s)</small></div>`).join("");
    cont.classList.add("activo");
    cont.querySelectorAll("[data-cli]").forEach(item => item.addEventListener("click", () => {
      seleccion.clienteId = item.dataset.cli;
      el("cliente-elegido").style.display = "flex";
      el("cliente-elegido").innerHTML = `✓ Cliente: <strong>${item.dataset.nombre}</strong> <button type="button" class="btn secundario pequeno" id="btn-quitar-cliente">Cambiar</button>`;
      el("cliente-buscar").value = ""; cont.classList.remove("activo");
      el("btn-quitar-cliente").addEventListener("click", () => { seleccion.clienteId = null; el("cliente-elegido").style.display = "none"; refrescarAutosDelCliente(); });
      refrescarAutosDelCliente();
    }));
  }, 250);
});

let _debTel;
el("ncli-telefono").addEventListener("input", () => {
  clearTimeout(_debTel);
  const tel = el("ncli-telefono").value.trim();
  const alerta = el("ncli-tel-alerta");
  if (tel.length < 7) { alerta.textContent = ""; return; }
  _debTel = setTimeout(async () => {
    const { data } = await sb.rpc("telefono_existente", { p_telefono: tel });
    if (data && data.length) {
      alerta.innerHTML = `<span style="color:var(--orange);">⚠ Ya existe <strong>${data[0].nombre_completo}</strong> con este teléfono. <a href="#" id="usar-existente">Usarlo</a></span>`;
      el("usar-existente").addEventListener("click", (e) => {
        e.preventDefault();
        seleccion.clienteId = data[0].id;
        document.querySelector('input[name="modo-cliente"][value="existente"]').checked = true;
        el("cliente-modo-nuevo").style.display = "none"; el("cliente-modo-existente").style.display = "block";
        el("cliente-elegido").style.display = "flex";
        el("cliente-elegido").innerHTML = `✓ Cliente: <strong>${data[0].nombre_completo}</strong>`;
        refrescarAutosDelCliente();
      });
    } else { alerta.innerHTML = `<span style="color:var(--green);">✓ Teléfono disponible.</span>`; }
  }, 300);
});

async function refrescarAutosDelCliente() {
  const sel = el("vehiculo-existente-select");
  if (!seleccion.clienteId) { sel.innerHTML = `<option value="">Primero elige un cliente…</option>`; return; }
  const { data } = await sb.from("vehiculos").select("*").eq("cliente_id", seleccion.clienteId).order("placa");
  const autos = data || [];
  sel.innerHTML = autos.length ? `<option value="">Selecciona un auto…</option>` + autos.map(v => `<option value="${v.id}">${v.placa} · ${v.marca} ${v.modelo} ${v.anio||""}${v.vin?" · VIN "+v.vin.slice(-6):""}</option>`).join("") : `<option value="">Este cliente no tiene autos — usa "Auto nuevo"</option>`;
}
el("vehiculo-existente-select").addEventListener("change", () => { seleccion.vehiculoId = el("vehiculo-existente-select").value || null; });

document.querySelectorAll('input[name="modo-vehiculo"]').forEach(r => r.addEventListener("change", () => {
  const nuevo = document.querySelector('input[name="modo-vehiculo"]:checked').value === "nuevo";
  el("vehiculo-modo-nuevo").style.display = nuevo ? "block" : "none";
  el("vehiculo-modo-existente").style.display = nuevo ? "none" : "block";
  if (nuevo) { seleccion.vehiculoId = null; cargarAniosCotizacion(); }
}));

async function cargarAniosCotizacion() {
  const { data } = await sb.rpc("autos_anios");
  el("nveh-anio").innerHTML = `<option value="">—</option>` + (data||[]).map(a=>`<option>${a}</option>`).join("");
}
el("nveh-anio").addEventListener("change", async () => {
  ["nveh-marca","nveh-modelo","nveh-version","nveh-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);
  if (!el("nveh-anio").value) return;
  const { data } = await sb.rpc("autos_marcas", { p_anio: Number(el("nveh-anio").value) });
  el("nveh-marca").innerHTML = `<option value="">—</option>` + (data||[]).map(m=>`<option>${m}</option>`).join("");
});
el("nveh-marca").addEventListener("change", async () => {
  ["nveh-modelo","nveh-version","nveh-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);
  if (!el("nveh-marca").value) return;
  const { data } = await sb.rpc("autos_modelos", { p_anio: Number(el("nveh-anio").value), p_marca: el("nveh-marca").value });
  el("nveh-modelo").innerHTML = `<option value="">—</option>` + (data||[]).map(m=>`<option>${m}</option>`).join("");
});
el("nveh-modelo").addEventListener("change", async () => {
  ["nveh-version","nveh-motor"].forEach(i=>el(i).innerHTML=`<option value="">—</option>`);
  if (!el("nveh-modelo").value) return;
  const base = { p_anio: Number(el("nveh-anio").value), p_marca: el("nveh-marca").value, p_modelo: el("nveh-modelo").value };
  const { data: vers } = await sb.rpc("autos_versiones", base);
  el("nveh-version").innerHTML = `<option value="">—</option>` + (vers||[]).map(v=>`<option>${v}</option>`).join("");
  const { data: mot } = await sb.rpc("autos_motores", { ...base, p_version: "" });
  el("nveh-motor").innerHTML = `<option value="">—</option>` + (mot||[]).map(m=>`<option>${m}</option>`).join("");
});
el("nveh-manual").addEventListener("change", () => {
  const on = el("nveh-manual").checked;
  el("nveh-marca-manual").disabled = !on; el("nveh-modelo-manual").disabled = !on;
  ["nveh-marca","nveh-modelo","nveh-version","nveh-motor"].forEach(i=>el(i).disabled = on);
});

let _debVin;
el("nveh-vin").addEventListener("input", () => {
  clearTimeout(_debVin);
  const vin = el("nveh-vin").value.trim();
  const alerta = el("nveh-vin-alerta");
  if (vin.length < 5) { alerta.textContent = ""; return; }
  _debVin = setTimeout(async () => {
    const { data } = await sb.rpc("buscar_vehiculo", { p_texto: vin });
    if (data && data.length) {
      alerta.innerHTML = `<span style="color:var(--orange);">⚠ Este VIN ya existe (${data[0].marca} ${data[0].modelo}, placa ${data[0].placa}). <a href="#" id="usar-veh">Usar ese auto</a></span>`;
      el("usar-veh").addEventListener("click", (e) => { e.preventDefault();
        seleccion.vehiculoId = data[0].id;
        document.querySelector('input[name="modo-vehiculo"][value="existente"]').checked = true;
        el("vehiculo-modo-nuevo").style.display = "none"; el("vehiculo-modo-existente").style.display = "block";
        if (!seleccion.clienteId && data[0].cliente_id) seleccion.clienteId = data[0].cliente_id;
        refrescarAutosDelCliente().then(() => { el("vehiculo-existente-select").value = data[0].id; });
      });
    } else { alerta.innerHTML = `<span style="color:var(--green);">✓ VIN nuevo.</span>`; }
  }, 300);
});

function resetInlineCotizacion() {
  seleccion.clienteId = null; seleccion.vehiculoId = null;
  document.querySelector('input[name="modo-cliente"][value="existente"]').checked = true;
  document.querySelector('input[name="modo-vehiculo"][value="existente"]').checked = true;
  el("cliente-modo-nuevo").style.display = "none"; el("cliente-modo-existente").style.display = "block";
  el("vehiculo-modo-nuevo").style.display = "none"; el("vehiculo-modo-existente").style.display = "block";
  el("cliente-buscar").value = ""; el("cliente-elegido").style.display = "none";
  el("cliente-sugerencias").classList.remove("activo");
  ["ncli-nombre","ncli-telefono","ncli-correo","ncli-rfc","ncli-direccion","ncli-obs","nveh-vin","nveh-placa","nveh-color","nveh-km","nveh-marca-manual","nveh-modelo-manual"].forEach(i=>el(i).value="");
  el("ncli-tel-alerta").textContent = ""; el("nveh-vin-alerta").textContent = "";
  el("vehiculo-existente-select").innerHTML = `<option value="">Primero elige un cliente…</option>`;
  if (el("nveh-manual")) el("nveh-manual").checked = false;
}

// ============================================================================
// COTIZACIÓN · abrir / conceptos / guardar
// ============================================================================
async function abrirCotizacion(id) {
  estado.cotizacionActualId = id;
  el("titulo-modal-cotizacion").textContent = id ? "Cotización" : "Nueva cotización";
  el("cotizacion-id").value = id || "";
  document.querySelector('.pestana[data-pestana="datos"]').click();
  el("cotizacion-entrega").value = ""; el("cotizacion-km").value = ""; el("cotizacion-observaciones").value = "";
  el("cotizacion-estado-comercial").value = "borrador"; el("cotizacion-estado-comercial").disabled = false;
  el("cotizacion-estado-servicio").value = "sin_iniciar";
  el("cotizacion-notas-finales").value = ""; el("cotizacion-cerrar-adeudo").checked = false;
  el("cotizacion-motivo-adeudo").value = ""; el("cotizacion-fecha-compromiso").value = "";
  el("campos-adeudo").style.display = "none"; actualizarVisibilidadPanelCierre();
  estado.conceptosEnEdicion = [];
  el("tabla-pagos-cotizacion").innerHTML = ""; el("lista-seguimiento").innerHTML = ""; el("galeria-archivos").innerHTML = "";
  resetInlineCotizacion();

  if (id) {
    const { data: c } = await sb.from("cotizaciones").select("*").eq("id", id).single();
    el("cotizacion-entrega").value = c.entrega_estimada || ""; el("cotizacion-km").value = c.kilometraje_visita || "";
    el("cotizacion-observaciones").value = c.observaciones || "";
    el("cotizacion-estado-comercial").value = c.estado_comercial; el("cotizacion-estado-servicio").value = c.estado_servicio;
    const yaCerrada = c.estado_comercial === "cerrada";
    el("cotizacion-estado-comercial").disabled = yaCerrada && !esAdmin();
    el("cotizacion-notas-finales").value = c.notas_finales || "";
    el("cotizacion-cerrar-adeudo").checked = !!c.cerrada_con_adeudo;
    el("cotizacion-motivo-adeudo").value = c.motivo_adeudo || "";
    el("cotizacion-fecha-compromiso").value = c.fecha_compromiso_pago || "";
    el("campos-adeudo").style.display = c.cerrada_con_adeudo ? "block" : "none";
    actualizarVisibilidadPanelCierre();
    // Precargar cliente/vehículo en la selección inline
    seleccion.clienteId = c.cliente_id; seleccion.vehiculoId = c.vehiculo_id;
    const cli = estado.clientes.find(x => x.id === c.cliente_id);
    el("cliente-elegido").style.display = "flex";
    el("cliente-elegido").innerHTML = `✓ Cliente: <strong>${cli ? cli.nombre_completo : "—"}</strong>`;
    await refrescarAutosDelCliente();
    el("vehiculo-existente-select").value = c.vehiculo_id;
    await cargarArchivosCotizacion(id);
    const { data: detalle } = await sb.from("detalle_cotizacion").select("*").eq("cotizacion_id", id).order("created_at");
    estado.conceptosEnEdicion = (detalle || []).map(d => ({ ...d }));
    await cargarPagosCotizacion(id);
    await cargarSeguimientoCotizacion(id);
  }
  renderConceptos();
  actualizarGatePagos();   // refresca el gate según haya o no cotización
  abrirModal("modal-cotizacion");
}

function renderConceptos() {
  el("cuerpo-conceptos").innerHTML = estado.conceptosEnEdicion.map((cpt, i) => `
    <tr>
      <td><select data-campo="tipo" data-i="${i}">${["servicio","mano_obra","consumible","refaccion_libre","descuento","nota"].map(t=>`<option value="${t}" ${cpt.tipo===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></td>
      <td><input data-campo="descripcion" data-i="${i}" value="${cpt.descripcion||""}"></td>
      <td><input type="number" step="1" min="1" data-campo="cantidad" data-i="${i}" value="${cpt.cantidad||1}"></td>
      <td><input type="number" step="0.01" data-campo="precio_unitario" data-i="${i}" value="${cpt.precio_unitario||0}"></td>
      <td><input type="number" step="0.01" data-campo="descuento" data-i="${i}" value="${cpt.descuento||0}"></td>
      <td data-importe-i="${i}">$${money(cpt.importe||0)}</td>
      <td><button type="button" class="btn secundario pequeno" data-quitar="${i}">×</button></td>
    </tr>`).join("");
  el("cuerpo-conceptos").querySelectorAll("[data-campo]").forEach(input => input.addEventListener("input", () => {
    const i = Number(input.dataset.i), campo = input.dataset.campo;
    if (campo === "cantidad") estado.conceptosEnEdicion[i][campo] = Math.max(1, Math.floor(Number(input.value||1)));
    else if (["precio_unitario","descuento"].includes(campo)) estado.conceptosEnEdicion[i][campo] = Number(input.value||0);
    else estado.conceptosEnEdicion[i][campo] = input.value;
    recalcularConcepto(i);
  }));
  el("cuerpo-conceptos").querySelectorAll("[data-quitar]").forEach(b => b.addEventListener("click", () => { estado.conceptosEnEdicion.splice(Number(b.dataset.quitar),1); renderConceptos(); recalcularTotales(); }));
  recalcularTotales();
}
function recalcularConcepto(i) {
  const c = estado.conceptosEnEdicion[i];
  c.importe = Math.max(0, (c.cantidad||0)*(c.precio_unitario||0) - (c.descuento||0));
  const celda = document.querySelector(`[data-importe-i="${i}"]`);
  if (celda) celda.textContent = "$" + money(c.importe);
  recalcularTotales();
}
function recalcularTotales() {
  const subtotal = estado.conceptosEnEdicion.reduce((s,c)=>s+(c.cantidad||0)*(c.precio_unitario||0),0);
  const descuento = estado.conceptosEnEdicion.reduce((s,c)=>s+(c.descuento||0),0);
  el("cotizacion-subtotal").textContent = money(subtotal);
  el("cotizacion-descuento").textContent = money(descuento);
  el("cotizacion-total").textContent = money(Math.max(0, subtotal - descuento));
}
el("btn-agregar-concepto").addEventListener("click", () => { estado.conceptosEnEdicion.push({ tipo:"servicio", descripcion:"", cantidad:1, precio_unitario:0, descuento:0, importe:0 }); renderConceptos(); });

function actualizarVisibilidadPanelCierre() { el("panel-cierre").style.display = el("cotizacion-estado-comercial").value === "cerrada" ? "block" : "none"; }
el("cotizacion-estado-comercial").addEventListener("change", actualizarVisibilidadPanelCierre);
el("cotizacion-cerrar-adeudo").addEventListener("change", () => { el("campos-adeudo").style.display = el("cotizacion-cerrar-adeudo").checked ? "block" : "none"; });

function validarReglasDeCierre(saldoActual) {
  if (el("cotizacion-estado-comercial").value !== "cerrada") return null;
  if (el("cotizacion-estado-servicio").value !== "vehiculo_entregado") return "No se puede cerrar: el estado de servicio debe ser 'Vehículo entregado'.";
  if (!el("cotizacion-notas-finales").value.trim()) return "No se puede cerrar: faltan las notas finales.";
  const conAdeudo = el("cotizacion-cerrar-adeudo").checked;
  if (!conAdeudo) { if (saldoActual > 0) return "No se puede cerrar con saldo pendiente. Marca 'Cerrar con adeudo' o registra el pago."; }
  else { if (!esAdmin()) return "Cerrar con adeudo requiere autorización de un administrador."; if (!el("cotizacion-motivo-adeudo").value.trim()) return "Cerrar con adeudo requiere un motivo."; if (!el("cotizacion-fecha-compromiso").value) return "Cerrar con adeudo requiere fecha compromiso."; }
  return null;
}

el("btn-guardar-cotizacion").addEventListener("click", async () => {
  // ---- V6 · Resolver cliente y vehículo (existente o nuevo) ----
  const modoCli = document.querySelector('input[name="modo-cliente"]:checked').value;
  const modoVeh = document.querySelector('input[name="modo-vehiculo"]:checked').value;
  if (modoCli === "existente" && !seleccion.clienteId) { mostrarMensaje("mensaje-cotizacion", "Selecciona o crea un cliente.", "error"); return; }
  if (modoCli === "nuevo" && (!el("ncli-nombre").value.trim() || !el("ncli-telefono").value.trim())) { mostrarMensaje("mensaje-cotizacion", "El cliente nuevo requiere nombre y teléfono.", "error"); return; }
  if (modoVeh === "existente" && !seleccion.vehiculoId) { mostrarMensaje("mensaje-cotizacion", "Selecciona un auto del cliente o captura uno nuevo.", "error"); return; }
  const marca = el("nveh-manual").checked ? el("nveh-marca-manual").value.trim() : el("nveh-marca").value;
  const modelo = el("nveh-manual").checked ? el("nveh-modelo-manual").value.trim() : el("nveh-modelo").value;
  if (modoVeh === "nuevo" && (!marca || !modelo || !el("nveh-placa").value.trim())) { mostrarMensaje("mensaje-cotizacion", "El auto nuevo requiere marca, modelo y placa.", "error"); return; }

  const { data: resuelto, error: errR } = await sb.rpc("resolver_cliente_vehiculo", {
    p_cliente_id: modoCli === "existente" ? seleccion.clienteId : null,
    p_cli_nombre: el("ncli-nombre").value, p_cli_telefono: el("ncli-telefono").value,
    p_cli_correo: el("ncli-correo").value, p_cli_rfc: el("ncli-rfc").value,
    p_cli_direccion: el("ncli-direccion").value, p_cli_obs: el("ncli-obs").value,
    p_vehiculo_id: modoVeh === "existente" ? seleccion.vehiculoId : null,
    p_veh_vin: el("nveh-vin").value, p_veh_placa: el("nveh-placa").value,
    p_veh_marca: marca, p_veh_modelo: modelo,
    p_veh_anio: el("nveh-anio").value ? Number(el("nveh-anio").value) : null,
    p_veh_version: el("nveh-version").value, p_veh_motor: el("nveh-motor").value,
    p_veh_color: el("nveh-color").value, p_veh_km: el("nveh-km").value ? Number(el("nveh-km").value) : null,
  });
  if (errR || !resuelto || !resuelto.length) { mostrarMensaje("mensaje-cotizacion", "Error al resolver cliente/vehículo: " + (errR?.message || ""), "error"); return; }
  const clienteId = resuelto[0].cliente_id;
  const vehiculoId = resuelto[0].vehiculo_id;

  if (modoVeh === "nuevo" && el("nveh-manual").checked && el("nveh-anio").value) {
    await sb.rpc("agregar_auto_catalogo", { p_anio: Number(el("nveh-anio").value), p_marca: marca, p_modelo: modelo, p_version: el("nveh-version").value || null, p_motor: el("nveh-motor").value || null });
  }

  const subtotal = estado.conceptosEnEdicion.reduce((s,c)=>s+(c.cantidad||0)*(c.precio_unitario||0),0);
  const descuento = estado.conceptosEnEdicion.reduce((s,c)=>s+(c.descuento||0),0);
  const total = Math.max(0, subtotal - descuento);

  let saldoActual = total;
  const idExistente = el("cotizacion-id").value;
  if (idExistente) {
    const { data: pv } = await sb.from("pagos").select("importe").eq("cotizacion_id", idExistente).eq("estado","valido");
    saldoActual = Math.max(0, total - (pv||[]).reduce((s,p)=>s+Number(p.importe),0));
  }
  const errCierre = validarReglasDeCierre(saldoActual);
  if (errCierre) { mostrarMensaje("mensaje-cotizacion", errCierre, "error"); return; }

  const conAdeudo = el("cotizacion-cerrar-adeudo").checked && el("cotizacion-estado-comercial").value === "cerrada";
  const encabezado = {
    cliente_id: clienteId, vehiculo_id: vehiculoId,
    entrega_estimada: el("cotizacion-entrega").value || null,
    kilometraje_visita: el("cotizacion-km").value ? Number(el("cotizacion-km").value) : null,
    observaciones: el("cotizacion-observaciones").value.trim() || null,
    estado_comercial: el("cotizacion-estado-comercial").value,
    estado_servicio: el("cotizacion-estado-servicio").value,
    estado_pago: saldoActual <= 0 && total > 0 ? "pagada" : (saldoActual < total ? "parcialmente_pagada" : "sin_pago"),
    subtotal, descuento_total: descuento, total,
    notas_finales: el("cotizacion-notas-finales").value.trim() || null,
    cerrada_con_adeudo: conAdeudo,
    motivo_adeudo: conAdeudo ? el("cotizacion-motivo-adeudo").value.trim() : null,
    fecha_compromiso_pago: conAdeudo ? el("cotizacion-fecha-compromiso").value : null,
  };

  let id = el("cotizacion-id").value;
  if (!id) {
    const { data: folio } = await sb.rpc("siguiente_folio");
    encabezado.folio = folio; encabezado.usuario_responsable = estado.usuario.id; encabezado.created_by = estado.usuario.id;
    const { data, error } = await sb.from("cotizaciones").insert(encabezado).select().single();
    if (error) { mostrarMensaje("mensaje-cotizacion", "Error al crear: " + error.message, "error"); return; }
    id = data.id; el("cotizacion-id").value = id;
    el("titulo-modal-cotizacion").textContent = data.folio || "Cotización";
    await registrarBitacora("cotizaciones", id, "crear", null, encabezado);
  } else {
    const { error } = await sb.from("cotizaciones").update(encabezado).eq("id", id);
    if (error) { mostrarMensaje("mensaje-cotizacion", "Error al actualizar: " + error.message, "error"); return; }
    await registrarBitacora("cotizaciones", id, "actualizar", null, encabezado);
  }

  await sb.from("detalle_cotizacion").delete().eq("cotizacion_id", id);
  if (estado.conceptosEnEdicion.length) {
    const filas = estado.conceptosEnEdicion.map(c => ({ cotizacion_id: id, tipo: c.tipo, descripcion: c.descripcion, cantidad: c.cantidad || 1, precio_unitario: c.precio_unitario || 0, descuento: c.descuento || 0, importe: c.importe || 0 }));
    await sb.from("detalle_cotizacion").insert(filas);
  }
  actualizarGatePagos();  // ahora ya hay cotización → habilita pagos/seguimiento/archivos
  mostrarMensaje("mensaje-cotizacion", "Cotización guardada correctamente. Ya puedes registrar pagos, seguimiento y archivos.");
  await cargarDatosBase();
  await cargarCotizaciones();
});

// --- Pagos ---
async function cargarPagosCotizacion(cotizacionId) {
  const { data: pagos } = await sb.from("pagos").select("*").eq("cotizacion_id", cotizacionId).order("fecha");
  const { data: cot } = await sb.from("cotizaciones").select("total").eq("id", cotizacionId).single();
  const validos = (pagos||[]).filter(p => p.estado === "valido");
  const saldo = (cot ? cot.total : 0) - validos.reduce((s,p)=>s+Number(p.importe),0);
  el("cotizacion-saldo").textContent = money(saldo);
  el("tabla-pagos-cotizacion").innerHTML = (pagos||[]).map(p => `<tr><td>${p.fecha}</td><td>$${money(p.importe)}</td><td>${p.metodo}</td><td>${p.referencia||"—"}</td><td>${p.estado}</td><td>${p.estado==='valido'&&esAdmin()?`<button class="btn secundario pequeno" data-reversar="${p.id}">Reversar</button>`:""}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio-tabla">Sin pagos registrados.</td></tr>`;
  document.querySelectorAll("[data-reversar]").forEach(b => b.addEventListener("click", async () => {
    const motivo = prompt("Motivo de la reversión (obligatorio):"); if (!motivo) return;
    await sb.from("pagos").update({ estado:"reversado" }).eq("id", b.dataset.reversar);
    await registrarBitacora("pagos", b.dataset.reversar, "reversar", null, { motivo });
    cargarPagosCotizacion(cotizacionId);
  }));
}
el("btn-agregar-pago").addEventListener("click", async () => {
  const id = el("cotizacion-id").value;
  if (!id) { mostrarMensaje("mensaje-cotizacion", "Guarda la cotización antes de registrar pagos.", "error"); return; }
  const importe = Number(el("pago-importe").value || 0); if (importe <= 0) return;
  const registro = { cotizacion_id: id, importe, metodo: el("pago-metodo").value, referencia: el("pago-referencia").value.trim()||null, comentario: el("pago-comentario").value.trim()||null, usuario_id: estado.usuario.id };
  const { data, error } = await sb.from("pagos").insert(registro).select().single();
  if (error) { alert("Error al registrar pago: " + error.message); return; }
  await registrarBitacora("pagos", data.id, "crear", null, registro);
  el("pago-importe").value=""; el("pago-referencia").value=""; el("pago-comentario").value="";
  cargarPagosCotizacion(id);
});

// --- Seguimiento ---
async function cargarSeguimientoCotizacion(cotizacionId) {
  const { data } = await sb.from("seguimientos").select("*").eq("cotizacion_id", cotizacionId).order("created_at", { ascending: false });
  el("lista-seguimiento").innerHTML = (data||[]).map(s => `<li>${s.descripcion}<br><small>${new Date(s.created_at).toLocaleString("es-MX")}</small></li>`).join("") || `<li>Sin movimientos registrados.</li>`;
}
el("btn-agregar-seguimiento").addEventListener("click", async () => {
  const id = el("cotizacion-id").value; const texto = el("seguimiento-texto").value.trim();
  if (!id) { mostrarMensaje("mensaje-cotizacion", "Guarda la cotización antes de agregar seguimiento.", "error"); return; }
  if (!texto) return;
  await sb.from("seguimientos").insert({ cotizacion_id: id, descripcion: texto, usuario_id: estado.usuario.id, tipo: "nota" });
  el("seguimiento-texto").value = "";
  cargarSeguimientoCotizacion(id);
});

// ============================================================================
// IMPORTACIÓN MASIVA (CSV)
// ============================================================================
let _registrosImportacion = [];
el("input-importar").addEventListener("change", async (ev) => {
  const archivo = ev.target.files[0]; if (!archivo) return;
  const filas = parseCSV(await archivo.text());
  if (!filas.length) { mostrarMensaje("mensaje-importacion", "El archivo está vacío.", "error"); return; }
  const encabezados = filas[0].map(h => h.trim().toLowerCase());
  const requeridos = ["codigo","nombre","categoria","unidad_medida","precio_venta","estado"];
  const faltantes = requeridos.filter(r => !encabezados.includes(r));
  if (faltantes.length) { mostrarMensaje("mensaje-importacion", "Faltan columnas: " + faltantes.join(", "), "error"); return; }
  _registrosImportacion = filas.slice(1).filter(f => f.some(c => c.trim() !== "")).map(f => { const o = {}; encabezados.forEach((h,i)=>o[h]=(f[i]||"").trim()); return o; });
  const existentes = new Set(estado.servicios.map(s => s.codigo));
  let previa = `<table class="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Precio</th><th>Estado</th></tr></thead><tbody>`;
  _registrosImportacion.forEach(r => previa += `<tr><td>${r.codigo}</td><td>${r.nombre}</td><td>$${r.precio_venta}</td><td>${existentes.has(r.codigo)?"Actualiza":"Nuevo"}</td></tr>`);
  previa += `</tbody></table><button class="btn" id="btn-confirmar-importacion" style="margin-top:10px;">Aplicar ${_registrosImportacion.length} registro(s)</button>`;
  el("previa-importacion").innerHTML = previa;
  el("btn-confirmar-importacion").addEventListener("click", aplicarImportacion);
});
async function aplicarImportacion() {
  if (!esAdmin()) { mostrarMensaje("mensaje-importacion", "Solo un administrador puede aplicar importaciones.", "error"); return; }
  const existentes = new Set(estado.servicios.map(s => s.codigo));
  let nuevos=0, actualizados=0, errores=0;
  for (const r of _registrosImportacion) {
    const registro = { codigo:r.codigo, nombre:r.nombre, descripcion:r.descripcion||null, unidad_medida:r.unidad_medida||"servicio", precio_venta:Number(r.precio_venta||0), costo_interno:r.costo_interno?Number(r.costo_interno):null, impuesto:r.impuesto?Number(r.impuesto):0, estado:r.estado||"activo", observaciones:r.observaciones||null };
    const { error } = await sb.from("servicios").upsert(registro, { onConflict: "codigo" });
    if (error) { errores++; continue; }
    existentes.has(r.codigo) ? actualizados++ : nuevos++;
  }
  const resumen = { total:_registrosImportacion.length, nuevos, actualizados, errores };
  await sb.from("importaciones").insert({ archivo_nombre:"importacion", resumen, usuario_id: estado.usuario.id });
  await registrarBitacora("servicios", null, "importacion_masiva", null, resumen);
  mostrarMensaje("mensaje-importacion", `Importación aplicada: ${nuevos} nuevos, ${actualizados} actualizados, ${errores} con error.`);
  el("previa-importacion").innerHTML = ""; el("input-importar").value = ""; _registrosImportacion = [];
  await cargarDatosBase();
}
function parseCSV(texto) { return texto.trim().split(/\r?\n/).map(l => l.split(",").map(c => c.trim())); }

// ============================================================================
// ARCHIVOS ADJUNTOS
// ============================================================================
async function cargarArchivosCotizacion(cotizacionId) {
  const { data } = await sb.from("archivos_adjuntos").select("*").eq("cotizacion_id", cotizacionId).order("created_at", { ascending: false });
  const lista = data || [];
  el("galeria-archivos").innerHTML = lista.length ? lista.map(a => {
    const url = sb.storage.from("evidencias").getPublicUrl(a.storage_path).data.publicUrl;
    const esImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(a.nombre_archivo);
    return `<a href="${url}" target="_blank" class="archivo-item">${esImg?`<img src="${url}" alt="${a.nombre_archivo}">`:`<div class="archivo-generico">Archivo</div>`}<small>${a.tipo||"otro"}</small><small>${a.nombre_archivo}</small></a>`;
  }).join("") : `<div class="vacio-tabla">Sin archivos todavía.</div>`;
}
el("btn-subir-archivo").addEventListener("click", async () => {
  const id = el("cotizacion-id").value;
  if (!id) { mostrarMensaje("mensaje-archivo", "Guarda la cotización antes de subir archivos.", "error"); return; }
  const archivo = el("archivo-input").files[0];
  if (!archivo) { mostrarMensaje("mensaje-archivo", "Selecciona un archivo primero.", "error"); return; }
  const ruta = `${id}/${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const { error: errS } = await sb.storage.from("evidencias").upload(ruta, archivo);
  if (errS) { mostrarMensaje("mensaje-archivo", "Error al subir: " + errS.message, "error"); return; }
  const registro = { cotizacion_id: id, tipo: el("archivo-tipo").value, nombre_archivo: archivo.name, storage_path: ruta, usuario_id: estado.usuario.id };
  const { data, error } = await sb.from("archivos_adjuntos").insert(registro).select().single();
  if (error) { mostrarMensaje("mensaje-archivo", "Subido pero no registrado: " + error.message, "error"); return; }
  await registrarBitacora("archivos_adjuntos", data.id, "crear", null, registro);
  el("archivo-input").value = ""; mostrarMensaje("mensaje-archivo", "Archivo subido correctamente.");
  cargarArchivosCotizacion(id);
});

// ============================================================================
// PDF DE COTIZACIÓN
// ============================================================================
el("btn-pdf-cotizacion").addEventListener("click", async () => {
  const id = el("cotizacion-id").value;
  if (!id) { mostrarMensaje("mensaje-cotizacion", "Guarda la cotización antes de generar el PDF.", "error"); return; }
  await generarPDFCotizacion(id);
});
async function generarPDFCotizacion(cotizacionId) {
  const { data: c } = await sb.from("cotizaciones").select("*, clientes(nombre_completo, telefono, correo), vehiculos(placa, marca, modelo, anio, vin)").eq("id", cotizacionId).single();
  if (!c) { alert("No se encontró la cotización."); return; }
  const { data: detalle } = await sb.from("detalle_cotizacion").select("*").eq("cotizacion_id", cotizacionId).order("created_at");
  const { data: pagos } = await sb.from("pagos").select("*").eq("cotizacion_id", cotizacionId).eq("estado","valido");
  const pagado = (pagos||[]).reduce((s,p)=>s+Number(p.importe),0);
  const saldo = Math.max(0, Number(c.total||0) - pagado);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"letter" });
  const navy=[15,42,74], teal=[27,111,122], gris=[90,100,110];
  doc.setFillColor(...navy); doc.rect(0,0,612,70,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont(undefined,"bold"); doc.text("Taller Automotriz",40,30);
  doc.setFontSize(10); doc.setFont(undefined,"normal"); doc.text("Cotización de servicio",40,46);
  doc.setFontSize(12); doc.setFont(undefined,"bold"); doc.text(c.folio,572,30,{align:"right"});
  doc.setFontSize(9); doc.setFont(undefined,"normal"); doc.text("Fecha: "+(c.fecha||""),572,46,{align:"right"});
  let y=95; doc.setTextColor(...navy); doc.setFontSize(11); doc.setFont(undefined,"bold");
  doc.text("Cliente",40,y); doc.text("Vehículo",320,y);
  doc.setFont(undefined,"normal"); doc.setFontSize(9.5); doc.setTextColor(30,30,30); y+=16;
  doc.text(c.clientes?c.clientes.nombre_completo:"—",40,y);
  doc.text(c.vehiculos?`${c.vehiculos.marca} ${c.vehiculos.modelo} ${c.vehiculos.anio||""}`:"—",320,y); y+=14;
  doc.text(c.clientes&&c.clientes.telefono?"Tel: "+c.clientes.telefono:"",40,y);
  doc.text(c.vehiculos?"Placa: "+c.vehiculos.placa:"",320,y); y+=14;
  doc.text(c.clientes&&c.clientes.correo?c.clientes.correo:"",40,y);
  doc.text(c.vehiculos&&c.vehiculos.vin?"VIN: "+c.vehiculos.vin:"",320,y); y+=28;
  const filas = (detalle||[]).map(d => [d.descripcion, String(d.cantidad), "$"+money(d.precio_unitario), d.descuento?"$"+money(d.descuento):"—", "$"+money(d.importe)]);
  doc.autoTable({ startY:y, head:[["Concepto","Cant.","P. Unitario","Descuento","Importe"]], body:filas, theme:"striped", headStyles:{fillColor:teal,textColor:255,fontSize:9}, styles:{fontSize:9,textColor:[30,30,30]}, columnStyles:{1:{halign:"center"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}}, margin:{left:40,right:40} });
  let yF = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(9.5); doc.setTextColor(...gris);
  doc.text("Subtotal:",420,yF); doc.text("$"+money(c.subtotal),572,yF,{align:"right"}); yF+=14;
  doc.text("Descuento:",420,yF); doc.text("$"+money(c.descuento_total),572,yF,{align:"right"}); yF+=16;
  doc.setDrawColor(...navy); doc.line(420,yF-10,572,yF-10);
  doc.setFontSize(12); doc.setFont(undefined,"bold"); doc.setTextColor(...navy);
  doc.text("Total:",420,yF); doc.text("$"+money(c.total),572,yF,{align:"right"}); yF+=16;
  doc.setFontSize(9.5); doc.setFont(undefined,"normal"); doc.setTextColor(...gris);
  doc.text("Pagado:",420,yF); doc.text("$"+money(pagado),572,yF,{align:"right"}); yF+=14;
  doc.setFont(undefined,"bold"); doc.setTextColor(saldo>0?192:47, saldo>0?57:143, saldo>0?43:95);
  doc.text("Saldo pendiente:",420,yF); doc.text("$"+money(saldo),572,yF,{align:"right"});
  if (c.observaciones) { yF+=30; doc.setFontSize(10); doc.setFont(undefined,"bold"); doc.setTextColor(...navy); doc.text("Observaciones",40,yF); yF+=14; doc.setFont(undefined,"normal"); doc.setFontSize(9); doc.setTextColor(30,30,30); const ln=doc.splitTextToSize(c.observaciones,530); doc.text(ln,40,yF); yF+=ln.length*11; }
  yF+=26; doc.setFontSize(8); doc.setTextColor(...gris);
  doc.text(doc.splitTextToSize("Precios sujetos a cambio sin previo aviso hasta su autorización. La entrega del vehículo está condicionada a la liquidación del saldo pendiente, salvo autorización expresa de cierre con adeudo.",530),40,yF);
  doc.save(`${c.folio}.pdf`);
}

// ============================================================================
// USUARIOS (V3 + V4)
// ============================================================================
let _listaUsuarios = [];
async function cargarUsuarios(filtro = "") {
  el("tabla-usuarios").innerHTML = `<tr><td colspan="6" class="vacio-tabla">Cargando…</td></tr>`;
  const { data, error } = await sb.rpc("listar_usuarios");
  if (error) { el("tabla-usuarios").innerHTML = `<tr><td colspan="6" class="vacio-tabla">Error: ${error.message}</td></tr>`; return; }
  _listaUsuarios = data || [];
  renderTablaUsuarios(filtro);
}
function renderTablaUsuarios(filtro = "") {
  let lista = _listaUsuarios;
  if (filtro) { const f = filtro.toLowerCase(); lista = lista.filter(u => (u.nombre_completo||"").toLowerCase().includes(f) || (u.username||"").toLowerCase().includes(f) || (u.correo||"").toLowerCase().includes(f)); }
  const ROLES = { administrador:"Administrador", recepcion:"Recepción", consulta:"Consulta" };
  el("tabla-usuarios").innerHTML = lista.length ? lista.map(u => `<tr><td>${u.username?"@"+u.username:"⚠ Sin usuario"}</td><td>${u.nombre_completo||"—"}</td><td>${u.correo||"—"}</td><td>${ROLES[u.rol]||u.rol}</td><td>${u.activo?"Activo":"Inactivo"}</td><td><button class="btn secundario pequeno" data-editar-usuario="${u.id}">Editar perfil</button></td></tr>`).join("") : `<tr><td colspan="6" class="vacio-tabla">No hay usuarios. Crea uno con "Crear usuario".</td></tr>`;
  document.querySelectorAll("[data-editar-usuario]").forEach(b => b.addEventListener("click", () => abrirModalUsuario(_listaUsuarios.find(x => x.id === b.dataset.editarUsuario))));
}
el("buscar-usuario").addEventListener("input", e => renderTablaUsuarios(e.target.value));
el("btn-refrescar-usuarios").addEventListener("click", () => cargarUsuarios(el("buscar-usuario").value));

function abrirModalUsuario(u) {
  el("titulo-modal-usuario").textContent = u && u.nombre_completo ? `Perfil de ${u.nombre_completo}` : "Configurar perfil";
  el("usuario-id").value = u ? u.id : "";
  el("usuario-correo-display").value = u ? (u.correo || "—") : "";
  el("usuario-nombre").value = u ? u.nombre_completo || "" : "";
  el("usuario-username").value = u ? u.username || "" : "";
  el("usuario-rol").value = u ? u.rol || "consulta" : "consulta";
  el("usuario-activo").value = u && u.activo !== false ? "true" : "false";
  el("username-disponibilidad").textContent = "";
  el("usuario-password").value = "";
  abrirModal("modal-usuario");
}
el("btn-generar-username").addEventListener("click", async () => {
  const nombre = el("usuario-nombre").value.trim();
  if (!nombre) { el("username-disponibilidad").textContent = "Escribe primero el nombre."; return; }
  const u = await generarUsernameDesde(nombre);
  if (!u) { el("username-disponibilidad").textContent = "Escribe nombre y apellido."; return; }
  el("usuario-username").value = u;
  el("username-disponibilidad").innerHTML = `<span style="color:var(--green);">✓ Disponible: @${u}</span>`;
});
el("usuario-username").addEventListener("input", async () => {
  const val = el("usuario-username").value.trim().toLowerCase();
  if (!val) { el("username-disponibilidad").textContent = ""; return; }
  if (val.length < 3) { el("username-disponibilidad").innerHTML = "Mínimo 3 caracteres."; return; }
  const actual = _listaUsuarios.find(u => u.id === el("usuario-id").value);
  if (actual && actual.username === val) { el("username-disponibilidad").innerHTML = "Este es el usuario actual."; return; }
  const { data: disp } = await sb.rpc("username_disponible", { p_username: val });
  el("username-disponibilidad").innerHTML = disp ? `<span style="color:var(--green);">✓ Disponible</span>` : `<span style="color:var(--red);">✗ Ya está en uso.</span>`;
});
el("btn-guardar-usuario").addEventListener("click", async () => {
  const id = el("usuario-id").value;
  const username = el("usuario-username").value.trim().toLowerCase();
  const nombre = el("usuario-nombre").value.trim();
  const rol = el("usuario-rol").value;
  const activo = el("usuario-activo").value === "true";
  if (!nombre) { mostrarMensaje("mensaje-usuario", "El nombre es obligatorio.", "error"); return; }
  if (!username || username.length < 3) { mostrarMensaje("mensaje-usuario", "El usuario debe tener al menos 3 caracteres.", "error"); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { mostrarMensaje("mensaje-usuario", "Solo minúsculas, números y guión bajo.", "error"); return; }
  const { error } = await sb.rpc("actualizar_perfil", { p_id: id, p_username: username, p_nombre_completo: nombre, p_rol: rol, p_activo: activo });
  if (error) { mostrarMensaje("mensaje-usuario", "Error: " + error.message, "error"); return; }
  await registrarBitacora("perfiles", id, "actualizar_perfil", null, { username, nombre, rol, activo });
  mostrarMensaje("mensaje-usuario", "Perfil guardado correctamente.");
  cerrarModal("modal-usuario"); await cargarUsuarios(); await cargarDatosBase();
});

// V7 · Restablecer contraseña (vía Edge Function segura)
el("btn-reset-password")?.addEventListener("click", async () => {
  const id = el("usuario-id").value;
  const password = el("usuario-password").value;
  if (!id) { mostrarMensaje("mensaje-usuario", "Primero abre el perfil de un usuario.", "error"); return; }
  if (!password || password.length < 6) { mostrarMensaje("mensaje-usuario", "La contraseña debe tener al menos 6 caracteres.", "error"); return; }
  mostrarMensaje("mensaje-usuario", "Actualizando contraseña…");
  const { data, error } = await sb.functions.invoke("gestion-usuario", { body: { accion: "cambiar_password", usuario_id: id, password } });
  if (error) {
    let detalle = error.message;
    try { if (error.context && typeof error.context.json === "function") { const c = await error.context.json(); detalle = c.mensaje || c.error || detalle; } } catch(_) {}
    mostrarMensaje("mensaje-usuario", "Error: " + detalle, "error"); return;
  }
  if (data && data.ok === false) { mostrarMensaje("mensaje-usuario", "Error: " + data.mensaje, "error"); return; }
  await registrarBitacora("perfiles", id, "cambiar_password", null, { por: estado.usuario.id });
  el("usuario-password").value = "";
  mostrarMensaje("mensaje-usuario", "Contraseña actualizada correctamente.");
});

// V7 · Eliminar usuario (vía Edge Function segura)
el("btn-eliminar-usuario")?.addEventListener("click", async () => {
  const id = el("usuario-id").value;
  const nombre = el("usuario-nombre").value || "este usuario";
  if (!id) { mostrarMensaje("mensaje-usuario", "Primero abre el perfil de un usuario.", "error"); return; }
  if (id === estado.usuario.id) { mostrarMensaje("mensaje-usuario", "No puedes eliminar tu propia cuenta.", "error"); return; }
  if (!confirm(`¿Seguro que deseas ELIMINAR a "${nombre}"? Esta acción no se puede deshacer.`)) return;
  mostrarMensaje("mensaje-usuario", "Eliminando usuario…");
  const { data, error } = await sb.functions.invoke("gestion-usuario", { body: { accion: "eliminar", usuario_id: id } });
  if (error) {
    let detalle = error.message;
    try { if (error.context && typeof error.context.json === "function") { const c = await error.context.json(); detalle = c.mensaje || c.error || detalle; } } catch(_) {}
    mostrarMensaje("mensaje-usuario", "Error: " + detalle, "error"); return;
  }
  if (data && data.ok === false) { mostrarMensaje("mensaje-usuario", "Error: " + data.mensaje, "error"); return; }
  await registrarBitacora("perfiles", id, "eliminar_usuario", null, { nombre });
  cerrarModal("modal-usuario"); await cargarUsuarios(); await cargarDatosBase();
});

async function generarUsernameDesde(nombreCompleto) {
  const partes = nombreCompleto.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return null;
  const primer = partes[0];
  const apellido = partes.length >= 3 ? partes[partes.length-2] : partes[1];
  const candidatos = [primer[0]+apellido, primer.slice(0,2)+apellido, primer.slice(0,3)+apellido, primer+apellido];
  for (const c of candidatos) { const { data: disp } = await sb.rpc("username_disponible", { p_username: c }); if (disp) return c; }
  return primer[0]+apellido+Math.floor(Math.random()*90+10);
}
el("btn-nuevo-usuario")?.addEventListener("click", () => {
  if (!esAdmin()) { alert("Solo un administrador puede crear usuarios."); return; }
  ["nuevo-nombre","nuevo-username","nuevo-correo","nuevo-password"].forEach(i=>el(i).value="");
  el("nuevo-rol").value = "consulta"; el("nuevo-username-estado").textContent = "";
  abrirModal("modal-crear-usuario");
});
el("btn-generar-nuevo-username")?.addEventListener("click", async () => {
  const nombre = el("nuevo-nombre").value.trim();
  if (!nombre) { el("nuevo-username-estado").textContent = "Escribe primero el nombre."; return; }
  el("nuevo-username-estado").textContent = "Generando…";
  const u = await generarUsernameDesde(nombre);
  if (!u) { el("nuevo-username-estado").textContent = "Escribe nombre y apellido."; return; }
  el("nuevo-username").value = u;
  el("nuevo-username-estado").innerHTML = `<span style="color:var(--green);">✓ Sugerido: @${u}</span>`;
});
el("nuevo-username")?.addEventListener("input", async () => {
  const val = el("nuevo-username").value.trim().toLowerCase();
  const es = el("nuevo-username-estado");
  if (!val) { es.textContent = ""; return; }
  if (val.length < 3) { es.innerHTML = `<span style="color:var(--orange);">Mínimo 3 caracteres.</span>`; return; }
  const { data: disp } = await sb.rpc("username_disponible", { p_username: val });
  es.innerHTML = disp ? `<span style="color:var(--green);">✓ Disponible</span>` : `<span style="color:var(--red);">✗ Ya está en uso.</span>`;
});
el("btn-confirmar-crear-usuario")?.addEventListener("click", async () => {
  const nombre = el("nuevo-nombre").value.trim();
  const username = el("nuevo-username").value.trim().toLowerCase();
  const correo = el("nuevo-correo").value.trim().toLowerCase();
  const password = el("nuevo-password").value;
  const rol = el("nuevo-rol").value;
  if (!nombre || !username || !correo || !password) { mostrarMensaje("mensaje-crear-usuario", "Todos los campos son obligatorios.", "error"); return; }
  if (password.length < 6) { mostrarMensaje("mensaje-crear-usuario", "La contraseña debe tener al menos 6 caracteres.", "error"); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { mostrarMensaje("mensaje-crear-usuario", "Usuario: solo minúsculas, números y guión bajo.", "error"); return; }
  const { data: disp } = await sb.rpc("username_disponible", { p_username: username });
  if (!disp) { mostrarMensaje("mensaje-crear-usuario", "Ese usuario ya está en uso.", "error"); return; }
  mostrarMensaje("mensaje-crear-usuario", "Creando usuario…");
  const { data, error } = await sb.functions.invoke("crear-usuario", { body: { correo, password, nombre_completo: nombre, username, rol } });
  if (error) {
    let detalle = error.message;
    try { if (error.context && typeof error.context.json === "function") { const cuerpo = await error.context.json(); detalle = cuerpo.mensaje || cuerpo.error || detalle; } } catch(_) {}
    mostrarMensaje("mensaje-crear-usuario", "Error: " + detalle, "error"); return;
  }
  if (data && (data.error || data.ok === false)) { mostrarMensaje("mensaje-crear-usuario", "Error: " + (data.error || data.mensaje), "error"); return; }
  await registrarBitacora("perfiles", data.id, "crear_usuario", null, { username, rol });
  mostrarMensaje("mensaje-crear-usuario", `Usuario @${username} creado correctamente.`);
  cerrarModal("modal-crear-usuario"); await cargarUsuarios();
});

// ============================================================================
// BITÁCORA
// ============================================================================
async function cargarBitacora() {
  const { data } = await sb.from("bitacora").select("*").order("created_at", { ascending: false }).limit(100);
  el("tabla-bitacora").innerHTML = (data||[]).map(b => `<tr><td>${new Date(b.created_at).toLocaleString("es-MX")}</td><td>${b.tabla_afectada}</td><td>${b.accion}</td><td>${b.valores_nuevos?JSON.stringify(b.valores_nuevos).slice(0,120):"—"}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio-tabla">Sin actividad registrada.</td></tr>`;
}
