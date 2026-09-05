// ============================================================================
// SISTEMA DE CONTROL DE TALLER AUTOMOTRIZ - APP.JS (UNIFICADO E HISTÓRICO)
// Integración completa: Base, V7 (Pagos/Gate), V8 (Catálogo/Combos), 
// V9 (Dashboard/Operatividad), V10 (Herramientas Especiales y Parches)
// ============================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
const estado = {
  usuario: null,
  perfil: null,
  clientes: [],
  vehiculos: [],
  catalogoMaestro: [],
  cotizaciones: [],
  herramientas: [],
  cotizacionActualId: null,
  conceptosEnEdicion: []
};

// --- AUXILIARES Y DOM ---
const el = (id) => document.getElementById(id);

function money(valor) {
  return Number(valor || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esAdmin() {
  return estado.perfil && estado.perfil.rol === "administrador";
}

function puedeEscribir() {
  return estado.perfil && (estado.perfil.rol === "administrador" || estado.perfil.rol === "asesor");
}

function mostrarMensaje(elementId, mensaje, tipo = "ok") {
  const cont = el(elementId);
  if (!cont) return;
  cont.textContent = mensaje;
  cont.className = `mensaje ${tipo === "error" ? "error" : "exito"}`;
  cont.style.display = "block";
  setTimeout(() => { cont.style.display = "none"; }, 4000);
}

function abrirModal(id) {
  const m = el(id);
  if (m) m.classList.add("activo");
}

function cerrarModal(id) {
  const m = el(id);
  if (m) m.classList.remove("activo");
}

// --- BITÁCORA Y AUDITORÍA HISTÓRICA ---
async function registrarBitacora(tabla, registroId, accion, valoresAnteriores, valoresNuevos) {
  try {
    await sb.from("bitacora").insert({
      usuario_id: estado.usuario ? estado.usuario.id : null,
      tabla_afectada: tabla,
      registro_id: registroId,
      accion: accion,
      valores_anteriores: valoresAnteriores,
      valores_nuevos: valoresNuevos
    });
  } catch (e) {
    console.error("Error al registrar bitácora:", e);
  }
}

// ============================================================================
// CARGA BASE DE DATOS Y CATÁLOGOS
// ============================================================================
async function cargarDatosBase() {
  try {
    const [resCli, resVeh, resCat, resHer] = await Promise.all([
      sb.from("clientes").select("*").order("nombre_completo"),
      sb.from("vehiculos").select("*").order("placa"),
      sb.from("catalogo_maestro").select("*").order("nombre"),
      sb.from("herramientas_especiales").select("*").order("nombre")
    ]);

    estado.clientes = resCli.data || [];
    estado.vehiculos = resVeh.data || [];
    estado.catalogoMaestro = resCat.data || [];
    estado.herramientas = resHer.data || [];

    llenarSelect("cliente", "cotizacion-cliente-select");
  } catch (err) {
    console.error("Error cargando datos base:", err);
  }
}

function llenarSelect(tipo, elementId) {
  const select = el(elementId);
  if (!select) return;

  if (tipo === "cliente") {
    select.innerHTML = `<option value="">Selecciona cliente…</option>` +
      estado.clientes.map(c => `<option value="${c.id}">${c.nombre_completo} (${c.telefono || "Sin tel"})</option>`).join("");
  }
}

// ============================================================================
// V9 · DASHBOARD E INICIO
// ============================================================================
async function cargarInicio() {
  const { data: cots } = await sb.from("cotizaciones").select("*, clientes(*), vehiculos(*)");
  const lista = cots || [];

  const totalCotizado = lista.reduce((s, c) => s + Number(c.total || 0), 0);
  const aprobadas = lista.filter(c => c.estado_comercial === "autorizada").length;
  const enProceso = lista.filter(c => c.estado_servicio === "en_proceso").length;

  if (el("dash-total-cotizaciones")) el("dash-total-cotizaciones").textContent = lista.length;
  if (el("dash-monto-total")) el("dash-monto-total").textContent = "$" + money(totalCotizado);
  if (el("dash-aprobadas")) el("dash-aprobadas").textContent = aprobadas;
  if (el("dash-en-proceso")) el("dash-en-proceso").textContent = enProceso;

  // Render resumen de cotizaciones recientes
  const tbody = el("tabla-inicio-recientes");
  if (tbody) {
    tbody.innerHTML = lista.slice(0, 5).map(c => `
      <tr>
        <td><strong>${c.folio}</strong></td>
        <td>${c.clientes ? c.clientes.nombre_completo : "—"}</td>
        <td>${c.vehiculos ? `${c.vehiculos.marca} ${c.vehiculos.modelo}` : "—"}</td>
        <td>$${money(c.total)}</td>
        <td><span class="badge ${c.estado_comercial === "autorizada" ? "verde" : "naranja"}">${c.estado_comercial}</span></td>
      </tr>
    `).join("");
  }
}

// ============================================================================
// MÓDULO DE COTIZACIONES (HISTÓRICO Y GENERAL)
// ============================================================================
async function cargarCotizaciones() {
  const { data: cots, error } = await sb.from("cotizaciones").select("*, clientes(*), vehiculos(*)").order("created_at", { ascending: false });
  if (error) return;
  estado.cotizaciones = cots || [];

  const tbody = el("tabla-cotizaciones");
  if (!tbody) return;

  tbody.innerHTML = estado.cotizaciones.length ? estado.cotizaciones.map(c => `
    <tr>
      <td><strong>${c.folio}</strong></td>
      <td>${c.fecha || "—"}</td>
      <td>${c.clientes ? c.clientes.nombre_completo : "—"}</td>
      <td>${c.vehiculos ? `${c.vehiculos.placa} — ${c.vehiculos.marca} ${c.vehiculos.modelo}` : "—"}</td>
      <td>$${money(c.total)}</td>
      <td><span class="badge azul">${c.estado_comercial}</span></td>
      <td><span class="badge verde">${c.estado_servicio}</span></td>
      <td>
        <button class="btn secundario pequeno" onclick="abrirCotizacion('${c.id}')">Ver / Editar</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="8" class="vacio-tabla">No hay cotizaciones registradas.</td></tr>`;
}

// ============================================================================
// CONFIGURACIÓN Y EVENTOS DE INTERFAZ (CLIENTE Y VEHÍCULO MODO INLINE)
// ============================================================================
document.querySelectorAll('input[name="modo-cliente"]').forEach(r => {
  r.addEventListener("change", (e) => {
    const modo = e.target.value;
    if (el("bloque-cliente-existente")) el("bloque-cliente-existente").style.display = modo === "existente" ? "block" : "none";
    if (el("bloque-cliente-nuevo")) el("bloque-cliente-nuevo").style.display = modo === "nuevo" ? "block" : "none";
  });
});

document.querySelectorAll('input[name="modo-vehiculo"]').forEach(r => {
  r.addEventListener("change", (e) => {
    const modo = e.target.value;
    if (el("bloque-vehiculo-existente")) el("bloque-vehiculo-existente").style.display = modo === "existente" ? "block" : "none";
    if (el("bloque-vehiculo-nuevo")) el("bloque-vehiculo-nuevo").style.display = modo === "nuevo" ? "block" : "none";
  });
});

el("cotizacion-cliente-select")?.addEventListener("change", (e) => {
  const clienteId = e.target.value;
  const selVeh = el("cotizacion-vehiculo-select");
  if (!selVeh) return;
  const vehs = estado.vehiculos.filter(v => v.cliente_id === clienteId);
  selVeh.innerHTML = `<option value="">Selecciona vehículo…</option>` + vehs.map(v => `<option value="${v.id}">${v.placa} — ${v.marca} ${v.modelo} (${v.anio||"S/A"})</option>`).join("");
});

// ============================================================================
// ABRIR Y EDITAR COTIZACIÓN
// ============================================================================
async function abrirCotizacion(id) {
  estado.cotizacionActualId = id || null;
  estado.conceptosEnEdicion = [];
  
  document.querySelectorAll(".pestana").forEach(p => p.classList.remove("activa"));
  const pDatos = document.querySelector('[data-pestana="datos"]');
  if (pDatos) pDatos.classList.add("activa");
  ["datos","pagos","seguimiento","archivos"].forEach(n => {
    const c = el("pestana-" + n);
    if (c) c.style.display = n === "datos" ? "block" : "none";
  });

  if (id) {
    const { data: cot, error } = await sb.from("cotizaciones").select("*, clientes(*), vehiculos(*)").eq("id", id).single();
    if (error || !cot) { alert("No se pudo cargar la cotización."); return; }
    
    el("titulo-modal-cotizacion").textContent = `Cotización ${cot.folio}`;
    el("cotizacion-id").value = cot.id;
    el("cotizacion-folio").value = cot.folio;
    el("cotizacion-fecha").value = cot.fecha || "";
    el("cotizacion-estado-comercial").value = cot.estado_comercial;
    el("cotizacion-estado-servicio").value = cot.estado_servicio;
    el("cotizacion-km").value = cot.kilometraje_visita || "";
    el("cotizacion-observaciones").value = cot.observaciones || "";

    const rCli = document.querySelector('input[name="modo-cliente"][value="existente"]');
    if (rCli) { rCli.checked = true; rCli.dispatchEvent(new Event("change")); }
    llenarSelect("cliente", "cotizacion-cliente-select");
    el("cotizacion-cliente-select").value = cot.cliente_id;

    const rVeh = document.querySelector('input[name="modo-vehiculo"][value="existente"]');
    if (rVeh) { rVeh.checked = true; rVeh.dispatchEvent(new Event("change")); }
    el("cotizacion-cliente-select").dispatchEvent(new Event("change"));
    el("cotizacion-vehiculo-select").value = cot.vehiculo_id;

    const { data: detalles } = await sb.from("cotizacion_detalles").select("*").eq("cotizacion_id", id).order("orden", { ascending: true });
    estado.conceptosEnEdicion = (detalles || []).map(d => ({
      id: d.id,
      concepto_codigo: d.concepto_codigo,
      descripcion: d.descripcion,
      cantidad: Number(d.cantidad),
      precio_unitario: Number(d.precio_unitario),
      subtotal: Number(d.subtotal)
    }));

    await cargarPagosCotizacion(id);
    await cargarSeguimientoCotizacion(id);
    await cargarArchivosCotizacion(id);
  } else {
    el("titulo-modal-cotizacion").textContent = "Nueva Cotización";
    el("cotizacion-id").value = "";
    el("cotizacion-folio").value = "AUTOGENERADO";
    el("cotizacion-fecha").value = new Date().toISOString().split("T")[0];
    el("cotizacion-estado-comercial").value = "borrador";
    el("cotizacion-estado-servicio").value = "sin_iniciar";
    el("cotizacion-km").value = "";
    el("cotizacion-observaciones").value = "";

    const rCli = document.querySelector('input[name="modo-cliente"][value="existente"]');
    if (rCli) { rCli.checked = true; rCli.dispatchEvent(new Event("change")); }
    llenarSelect("cliente", "cotizacion-cliente-select");

    const rVeh = document.querySelector('input[name="modo-vehiculo"][value="existente"]');
    if (rVeh) { rVeh.checked = true; rVeh.dispatchEvent(new Event("change")); }
    if (el("cotizacion-vehiculo-select")) el("cotizacion-vehiculo-select").innerHTML = `<option value="">Selecciona cliente primero…</option>`;

    if (el("tabla-pagos")) el("tabla-pagos").innerHTML = `<tr><td colspan="6" class="vacio-tabla">Guarda primero la cotización.</td></tr>`;
    if (el("lista-seguimiento")) el("lista-seguimiento").innerHTML = `<li class="vacio-tabla">Guarda primero la cotización.</li>`;
    if (el("lista-archivos")) el("lista-archivos").innerHTML = `<li class="vacio-tabla">Guarda primero la cotización.</li>`;
  }

  renderizarConceptosCotizacion();
  actualizarGatePagos();
  prellenarSelectCatalogoCotizacion();
  abrirModal("modal-cotizacion");
}

// ============================================================================
// V8 / V10 · CASCADA DE CATÁLOGOS Y MANEJO DE COMBOS CON RPC
// ============================================================================
function prellenarSelectCatalogoCotizacion() {
  const selTipo = el("cot-add-tipo");
  const selCat = el("cot-add-categoria");
  const selConcepto = el("cot-add-concepto");
  if (!selTipo || !selCat || !selConcepto) return;

  selTipo.value = "";
  selCat.innerHTML = `<option value="">Selecciona tipo…</option>`;
  selConcepto.innerHTML = `<option value="">Selecciona categoría/tipo…</option>`;
}

el("cot-add-tipo")?.addEventListener("change", (e) => {
  const tipo = e.target.value;
  const selCat = el("cot-add-categoria");
  const selConcepto = el("cot-add-concepto");
  if (!selCat || !selConcepto) return;

  if (tipo === "COMBO") {
    selCat.innerHTML = `<option value="TODAS">Combos / Paquetes</option>`;
    selCat.value = "TODAS";
    const combos = (estado.catalogoMaestro || []).filter(x => x.tipo === "COMBO" && x.activo);
    selConcepto.innerHTML = `<option value="">Selecciona combo…</option>` + combos.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join("");
  } else if (tipo) {
    const cats = (estado.catalogoMaestro || []).filter(x => x.tipo === "CATEGORIA" && x.activo);
    selCat.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join("");
    filtrarConceptosCotizacion();
  } else {
    selCat.innerHTML = `<option value="">Selecciona tipo…</option>`;
    selConcepto.innerHTML = `<option value="">Selecciona tipo…</option>`;
  }
});

el("cot-add-categoria")?.addEventListener("change", () => {
  if (el("cot-add-tipo")?.value !== "COMBO") filtrarConceptosCotizacion();
});

function filtrarConceptosCotizacion() {
  const tipo = el("cot-add-tipo")?.value;
  const cat = el("cot-add-categoria")?.value;
  const selConcepto = el("cot-add-concepto");
  if (!selConcepto) return;

  let items = (estado.catalogoMaestro || []).filter(x => ["CONCEPTO_SERVICIO","CONCEPTO_MANO_OBRA","CONCEPTO_REFACCION"].includes(x.tipo) && x.activo);
  if (tipo) items = items.filter(x => x.tipo === tipo);
  if (cat && cat !== "TODAS") items = items.filter(x => x.categoria_codigo === cat);

  selConcepto.innerHTML = `<option value="">Selecciona concepto…</option>` + items.map(i => `<option value="${i.codigo}">${i.nombre} (${i.codigo})</option>`).join("");
}

el("cot-add-concepto")?.addEventListener("change", (e) => {
  const cod = e.target.value;
  if (!cod) return;
  const item = (estado.catalogoMaestro || []).find(x => x.codigo === cod);
  if (item && item.tipo !== "COMBO") {
    if (el("cot-add-descripcion")) el("cot-add-descripcion").value = item.nombre;
  }
});

el("btn-agregar-concepto")?.addEventListener("click", async () => {
  const cod = el("cot-add-concepto")?.value;
  const descCustom = el("cot-add-descripcion")?.value.trim();
  const cant = Number(el("cot-add-cantidad")?.value || 1);
  const precio = Number(el("cot-add-precio")?.value || 0);

  if (!cod && !descCustom) { alert("Selecciona un concepto del catálogo o escribe una descripción."); return; }
  if (cant <= 0) { alert("La cantidad debe ser mayor a 0."); return; }

  const itemCat = (estado.catalogoMaestro || []).find(x => x.codigo === cod);

  if (itemCat && itemCat.tipo === "COMBO") {
    const { data: Hijos, error } = await sb.rpc("v10_combo_obtener_hijos", { p_combo_codigo: cod });
    if (error || !Hijos || !Hijos.length) {
      alert("El combo seleccionado no tiene conceptos hijos o no se pudo cargar.");
      return;
    }
    Hijos.forEach(h => {
      estado.conceptosEnEdicion.push({
        id: "tmp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        concepto_codigo: h.concepto_codigo,
        descripcion: h.nombre || h.concepto_codigo,
        cantidad: Number(h.cantidad_defecto || 1) * cant,
        precio_unitario: Number(h.precio_sugerido || 0),
        subtotal: (Number(h.cantidad_defecto || 1) * cant) * Number(h.precio_sugerido || 0)
      });
    });
  } else {
    estado.conceptosEnEdicion.push({
      id: "tmp_" + Date.now(),
      concepto_codigo: cod || null,
      descripcion: descCustom || (itemCat ? itemCat.nombre : "Concepto libre"),
      cantidad: cant,
      precio_unitario: precio,
      subtotal: cant * precio
    });
  }

  prellenarSelectCatalogoCotizacion();
  if (el("cot-add-descripcion")) el("cot-add-descripcion").value = "";
  if (el("cot-add-cantidad")) el("cot-add-cantidad").value = "1";
  if (el("cot-add-precio")) el("cot-add-precio").value = "0";

  renderizarConceptosCotizacion();
});

function renderizarConceptosCotizacion() {
  const tbody = el("tabla-cotizacion-conceptos");
  if (!tbody) return;

  if (!estado.conceptosEnEdicion.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio-tabla">No hay conceptos agregados a la cotización.</td></tr>`;
    calcularTotalesCotizacion();
    return;
  }

  tbody.innerHTML = estado.conceptosEnEdicion.map((item, idx) => `
    <tr>
      <td>${item.concepto_codigo || "—"}</td>
      <td><input type="text" class="input-tabla" value="${item.descripcion}" data-idx="${idx}" data-campo="descripcion"></td>
      <td><input type="number" step="0.01" min="0.01" class="input-tabla corto" value="${item.cantidad}" data-idx="${idx}" data-campo="cantidad"></td>
      <td><input type="number" step="0.01" min="0" class="input-tabla mediano" value="${item.precio_unitario}" data-idx="${idx}" data-campo="precio_unitario"></td>
      <td>$${money(item.subtotal)}</td>
      <td><button class="btn rojo pequeno" data-quitar-concepto="${idx}">✕</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const campo = e.target.dataset.campo;
      let val = e.target.value;
      if (campo === "cantidad" || campo === "precio_unitario") val = Number(val || 0);
      estado.conceptosEnEdicion[idx][campo] = val;
      estado.conceptosEnEdicion[idx].subtotal = estado.conceptosEnEdicion[idx].cantidad * estado.conceptosEnEdicion[idx].precio_unitario;
      renderizarConceptosCotizacion();
    });
  });

  tbody.querySelectorAll("[data-quitar-concepto]").forEach(b => {
    b.addEventListener("click", () => {
      const idx = Number(b.dataset.quitarConcepto);
      estado.conceptosEnEdicion.splice(idx, 1);
      renderizarConceptosCotizacion();
    });
  });

  calcularTotalesCotizacion();
}

function calcularTotalesCotizacion() {
  const subtotal = estado.conceptosEnEdicion.reduce((acc, x) => acc + (Number(x.subtotal) || 0), 0);
  const total = subtotal;
  if (el("cot-resumen-subtotal")) el("cot-resumen-subtotal").textContent = "$" + money(subtotal);
  if (el("cot-resumen-total")) el("cot-resumen-total").textContent = "$" + money(total);
}

// ============================================================================
// GUARDAR COTIZACIÓN
// ============================================================================
el("form-cotizacion")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!puedeEscribir()) { mostrarMensaje("mensaje-cotizacion", "No tienes permisos de escritura.", "error"); return; }
  if (!estado.conceptosEnEdicion.length) { mostrarMensaje("mensaje-cotizacion", "Agrega al menos un concepto a la cotización.", "error"); return; }

  let clienteId = null;
  let vehiculoId = null;

  const modoCliente = document.querySelector('input[name="modo-cliente"]:checked')?.value || "existente";
  if (modoCliente === "existente") {
    clienteId = el("cotizacion-cliente-select").value;
    if (!clienteId) { mostrarMensaje("mensaje-cotizacion", "Selecciona un cliente de la lista.", "error"); return; }
  } else {
    const nom = el("inline-cliente-nombre").value.trim();
    const tel = el("inline-cliente-telefono").value.trim();
    if (!nom) { mostrarMensaje("mensaje-cotizacion", "Escribe el nombre del nuevo cliente.", "error"); return; }
    const { data: nCli, error: errC } = await sb.from("clientes").insert({ nombre_completo: nom, telefono: tel || null, created_by: estado.usuario.id }).select().single();
    if (errC) { mostrarMensaje("mensaje-cotizacion", "Error creando cliente inline: " + errC.message, "error"); return; }
    clienteId = nCli.id;
  }

  const modoVehiculo = document.querySelector('input[name="modo-vehiculo"]:checked')?.value || "existente";
  if (modoVehiculo === "existente") {
    vehiculoId = el("cotizacion-vehiculo-select").value;
    if (!vehiculoId) { mostrarMensaje("mensaje-cotizacion", "Selecciona un vehículo de la lista.", "error"); return; }
  } else {
    const placa = el("inline-vehiculo-placa").value.trim().toUpperCase();
    const marca = el("inline-vehiculo-marca").value.trim();
    const modelo = el("inline-vehiculo-modelo").value.trim();
    const anio = el("inline-vehiculo-anio").value ? Number(el("inline-vehiculo-anio").value) : null;
    if (!placa || !marca || !modelo) { mostrarMensaje("mensaje-cotizacion", "Placa, marca y modelo son obligatorios para el nuevo vehículo.", "error"); return; }
    const { data: nVeh, error: errV } = await sb.from("vehiculos").insert({ cliente_id: clienteId, placa, marca, modelo, anio, created_by: estado.usuario.id }).select().single();
    if (errV) { mostrarMensaje("mensaje-cotizacion", "Error creando vehículo inline: " + errV.message, "error"); return; }
    vehiculoId = nVeh.id;
  }

  const total = estado.conceptosEnEdicion.reduce((acc, x) => acc + Number(x.subtotal || 0), 0);
  const cotHeader = {
    cliente_id: clienteId,
    vehiculo_id: vehiculoId,
    fecha: el("cotizacion-fecha").value,
    estado_comercial: el("cotizacion-estado-comercial").value,
    estado_servicio: el("cotizacion-estado-servicio").value,
    kilometraje_visita: el("cotizacion-km").value ? Number(el("cotizacion-km").value) : null,
    observaciones: el("cotizacion-observaciones").value.trim() || null,
    subtotal: total,
    total: total
  };

  let cotId = estado.cotizacionActualId;
  if (cotId) {
    const { error: errUpd } = await sb.from("cotizaciones").update(cotHeader).eq("id", cotId);
    if (errUpd) { mostrarMensaje("mensaje-cotizacion", "Error actualizando cotización: " + errUpd.message, "error"); return; }
    await sb.from("cotizacion_detalles").delete().eq("cotizacion_id", cotId);
  } else {
    cotHeader.created_by = estado.usuario.id;
    const { data: nCot, error: errIns } = await sb.from("cotizaciones").insert(cotHeader).select().single();
    if (errIns) { mostrarMensaje("mensaje-cotizacion", "Error creando cotización: " + errIns.message, "error"); return; }
    cotId = nCot.id;
    estado.cotizacionActualId = cotId;
    el("cotizacion-id").value = cotId;
    el("cotizacion-folio").value = nCot.folio;
  }

  const detallesInsert = estado.conceptosEnEdicion.map((item, idx) => ({
    cotizacion_id: cotId,
    orden: idx + 1,
    concepto_codigo: item.concepto_codigo || null,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    subtotal: item.subtotal
  }));

  const { error: errDet } = await sb.from("cotizacion_detalles").insert(detallesInsert);
  if (errDet) { mostrarMensaje("mensaje-cotizacion", "Error guardando conceptos: " + errDet.message, "error"); return; }

  await registrarBitacora("cotizaciones", cotId, cotHeader.id ? "actualizar" : "crear", null, cotHeader);
  mostrarMensaje("mensaje-cotizacion", "Cotización guardada exitosamente.", "ok");
  
  await cargarDatosBase();
  actualizarGatePagos();
  if (el("modulo-cotizaciones")?.classList.contains("activo")) cargarCotizaciones();
  if (el("modulo-inicio")?.classList.contains("activo")) cargarInicio();
});

// ============================================================================
// V7 · GATE Y GESTIÓN DE PAGOS
// ============================================================================
function actualizarGatePagos() {
  const pestanaPagos = document.querySelector('[data-pestana="pagos"]');
  if (!pestanaPagos) return;
  if (!estado.cotizacionActualId) {
    pestanaPagos.classList.add("deshabilitado");
  } else {
    pestanaPagos.classList.remove("deshabilitado");
  }
}

async function cargarPagosCotizacion(cotizacionId) {
  const { data: pagos } = await sb.from("pagos").select("*").eq("cotizacion_id", cotizacionId).order("fecha", { ascending: false });
  const lista = pagos || [];
  const tbody = el("tabla-pagos");
  if (!tbody) return;

  const totalPagado = lista.filter(p => p.estado === "valido").reduce((s, p) => s + Number(p.importe), 0);
  if (el("pago-resumen-acumulado")) el("pago-resumen-acumulado").textContent = "$" + money(totalPagado);

  tbody.innerHTML = lista.length ? lista.map(p => `
    <tr>
      <td>${p.fecha}</td>
      <td>$${money(p.importe)}</td>
      <td>${(p.forma_pago || "—").toUpperCase()}</td>
      <td><span class="badge ${p.estado === "valido" ? "verde" : "rojo"}">${p.estado}</span></td>
      <td>${p.observaciones || "—"}</td>
      <td>${puedeEscribir() && p.estado === "valido" ? `<button class="btn rojo pequeno" data-anular-pago="${p.id}">Anular</button>` : ""}</td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="vacio-tabla">No hay pagos registrados.</td></tr>`;

  tbody.querySelectorAll("[data-anular-pago]").forEach(b => {
    b.addEventListener("click", () => anularPago(b.dataset.anularPago));
  });
}

el("btn-agregar-pago")?.addEventListener("click", () => {
  if (!estado.cotizacionActualId) return;
  el("pago-fecha").value = new Date().toISOString().split("T")[0];
  el("pago-importe").value = "";
  el("pago-forma").value = "efectivo";
  el("pago-observaciones").value = "";
  abrirModal("modal-pago");
});

el("form-pago")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const cotId = estado.cotizacionActualId;
  const imp = Number(el("pago-importe").value);
  if (!cotId || imp <= 0) { alert("Importe inválido."); return; }

  const reg = {
    cotizacion_id: cotId,
    fecha: el("pago-fecha").value,
    importe: imp,
    forma_pago: el("pago-forma").value,
    estado: "valido",
    observaciones: el("pago-observaciones").value.trim() || null,
    created_by: estado.usuario.id
  };

  const { error } = await sb.from("pagos").insert(reg);
  if (error) { mostrarMensaje("mensaje-pago", "Error al registrar pago: " + error.message, "error"); return; }

  await registrarBitacora("pagos", null, "crear", null, reg);
  cerrarModal("modal-pago");
  await cargarPagosCotizacion(cotId);
  if (el("modulo-cotizaciones")?.classList.contains("activo")) cargarCotizaciones();
});

async function anularPago(pagoId) {
  if (!confirm("¿Deseas anular este pago?")) return;
  const { error } = await sb.from("pagos").update({ estado: "anulado" }).eq("id", pagoId);
  if (error) { alert("Error al anular pago: " + error.message); return; }
  await registrarBitacora("pagos", pagoId, "anular", null, { estado: "anulado" });
  await cargarPagosCotizacion(estado.cotizacionActualId);
  if (el("modulo-cotizaciones")?.classList.contains("activo")) cargarCotizaciones();
}

// ============================================================================
// SEGUIMIENTO Y ARCHIVOS ADJUNTOS
// ============================================================================
async function cargarSeguimientoCotizacion(cotizacionId) {
  const { data: segs } = await sb.from("seguimientos").select("*").eq("cotizacion_id", cotizacionId).order("created_at", { ascending: false });
  const ul = el("lista-seguimiento");
  if (!ul) return;

  ul.innerHTML = (segs || []).length ? (segs || []).map(s => `
    <li class="item-seguimiento">
      <div><strong>${s.descripcion}</strong></div>
      <small>${new Date(s.created_at).toLocaleString("es-MX")}</small>
    </li>
  `).join("") : `<li class="vacio-tabla">Sin notas de seguimiento.</li>`;
}

el("btn-agregar-seguimiento")?.addEventListener("click", async () => {
  const texto = prompt("Ingresa el avance o nota de seguimiento:");
  if (!texto || !texto.trim() || !estado.cotizacionActualId) return;

  const reg = { cotizacion_id: estado.cotizacionActualId, descripcion: texto.trim(), created_by: estado.usuario.id };
  const { error } = await sb.from("seguimientos").insert(reg);
  if (error) alert("Error al agregar seguimiento: " + error.message);
  else await cargarSeguimientoCotizacion(estado.cotizacionActualId);
});

async function cargarArchivosCotizacion(cotizacionId) {
  const { data: archs } = await sb.from("cotizacion_archivos").select("*").eq("cotizacion_id", cotizacionId).order("created_at", { ascending: false });
  const ul = el("lista-archivos");
  if (!ul) return;

  ul.innerHTML = (archs || []).length ? (archs || []).map(a => `
    <li class="item-archivo">
      <a href="${a.url}" target="_blank" rel="noopener">${a.nombre_archivo}</a>
      <small>(${Math.round(a.tamano_bytes / 1024)} KB)</small>
    </li>
  `).join("") : `<li class="vacio-tabla">No hay archivos adjuntos.</li>`;
}

el("btn-subir-archivo")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    const cotId = estado.cotizacionActualId;
    if (!file || !cotId) return;

    const path = `${cotId}/${Date.now()}_${file.name}`;
    const { error: errUp } = await sb.storage.from("adjuntos_cotizaciones").upload(path, file);
    if (errUp) { alert("Error subiendo archivo: " + errUp.message); return; }

    const { data: urlData } = sb.storage.from("adjuntos_cotizaciones").getPublicUrl(path);
    const reg = {
      cotizacion_id: cotId,
      nombre_archivo: file.name,
      ruta_storage: path,
      url: urlData.publicUrl,
      tamano_bytes: file.size,
      created_by: estado.usuario.id
    };

    await sb.from("cotizacion_archivos").insert(reg);
    await cargarArchivosCotizacion(cotId);
  };
  input.click();
});

// ============================================================================
// MÓDULO DE HERRAMIENTAS ESPECIALES (EXTENDIDO Y CONSERVADO)
// ============================================================================
async function cargarHerramientasEspeciales() {
  const { data, error } = await sb.from("herramientas_especiales").select("*").order("nombre");
  if (error) return;
  estado.herramientas = data || [];

  const tbody = el("tabla-herramientas");
  if (!tbody) return;

  tbody.innerHTML = estado.herramientas.length ? estado.herramientas.map(h => `
    <tr>
      <td><strong>${h.codigo || "—"}</strong></td>
      <td>${h.nombre}</td>
      <td>${h.categoria || "General"}</td>
      <td>${h.ubicacion || "Taller"}</td>
      <td><span class="badge ${h.estado === "disponible" ? "verde" : "rojo"}">${h.estado || "disponible"}</span></td>
      <td>${puedeEscribir() ? `<button class="btn secundario pequeno" onclick="editarHerramienta('${h.id}')">Editar</button>` : "—"}</td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="vacio-tabla">Sin herramientas especiales registradas.</td></tr>`;
}

function editarHerramienta(id) {
  const h = estado.herramientas.find(x => x.id === id);
  if (!h) return;
  if (el("herramienta-id")) el("herramienta-id").value = h.id;
  if (el("herramienta-codigo")) el("herramienta-codigo").value = h.codigo || "";
  if (el("herramienta-nombre")) el("herramienta-nombre").value = h.nombre || "";
  if (el("herramienta-categoria")) el("herramienta-categoria").value = h.categoria || "";
  if (el("herramienta-ubicacion")) el("herramienta-ubicacion").value = h.ubicacion || "";
  if (el("herramienta-estado")) el("herramienta-estado").value = h.estado || "disponible";
  abrirModal("modal-herramienta");
}

el("form-herramienta")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = el("herramienta-id")?.value;
  const reg = {
    codigo: el("herramienta-codigo")?.value.trim() || null,
    nombre: el("herramienta-nombre")?.value.trim(),
    categoria: el("herramienta-categoria")?.value.trim() || null,
    ubicacion: el("herramienta-ubicacion")?.value.trim() || null,
    estado: el("herramienta-estado")?.value || "disponible"
  };

  if (id) {
    await sb.from("herramientas_especiales").update(reg).eq("id", id);
  } else {
    await sb.from("herramientas_especiales").insert(reg);
  }
  cerrarModal("modal-herramienta");
  cargarHerramientasEspeciales();
});

// ============================================================================
// BITÁCORA Y GESTIÓN DE USUARIOS
// ============================================================================
async function cargarBitacora() {
  const { data } = await sb.from("bitacora").select("*, perfiles(nombre_completo)").order("created_at", { ascending: false }).limit(200);
  const lista = data || [];
  const tbody = el("tabla-bitacora");
  if (!tbody) return;

  tbody.innerHTML = lista.length ? lista.map(b => `
    <tr>
      <td>${new Date(b.created_at).toLocaleString("es-MX")}</td>
      <td>${b.perfiles ? b.perfiles.nombre_completo : "Sistema/Anónimo"}</td>
      <td><span class="badge azul">${b.accion}</span></td>
      <td>${b.tabla_afectada}</td>
      <td><small>${JSON.stringify(b.valores_nuevos || b.valores_anteriores || {})}</small></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="vacio-tabla">Bitácora vacía.</td></tr>`;
}

async function cargarUsuarios() {
  if (!esAdmin()) return;
  const { data } = await sb.from("perfiles").select("*").order("nombre_completo");
  const lista = data || [];
  const tbody = el("tabla-usuarios");
  if (!tbody) return;

  tbody.innerHTML = lista.length ? lista.map(u => `
    <tr>
      <td>${u.nombre_completo}</td>
      <td>${u.username || "—"}</td>
      <td><span class="badge ${u.rol === "administrador" ? "naranja" : "azul"}">${u.rol}</span></td>
      <td><span class="badge ${u.activo ? "verde" : "rojo"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
      <td><button class="btn secundario pequeno" data-editar-usuario="${u.id}">Editar</button></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="vacio-tabla">Sin usuarios.</td></tr>`;

  tbody.querySelectorAll("[data-editar-usuario]").forEach(b => {
    b.addEventListener("click", () => {
      const u = lista.find(x => x.id === b.dataset.editarUsuario);
      if (u) abrirModalUsuario(u);
    });
  });
}

function abrirModalUsuario(u) {
  el("usuario-id").value = u.id;
  el("usuario-nombre").value = u.nombre_completo;
  el("usuario-username").value = u.username || "";
  el("usuario-rol").value = u.rol;
  el("usuario-activo").value = u.activo ? "true" : "false";
  abrirModal("modal-usuario");
}

el("form-usuario")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = el("usuario-id").value;
  const reg = {
    nombre_completo: el("usuario-nombre").value.trim(),
    username: el("usuario-username").value.trim() || null,
    rol: el("usuario-rol").value,
    activo: el("usuario-activo").value === "true"
  };

  const { error } = await sb.from("perfiles").update(reg).eq("id", id);
  if (error) { mostrarMensaje("mensaje-usuario", "Error actualizando usuario: " + error.message, "error"); return; }

  await registrarBitacora("perfiles", id, "actualizar", null, reg);
  cerrarModal("modal-usuario");
  cargarUsuarios();
});
