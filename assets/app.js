// ============================================================================
// Sistema Taller Automotriz · app.js
// Lógica de la SPA: autenticación, navegación y CRUD contra Supabase.
// Esqueleto MVP — cada módulo cubre lo básico descrito en la especificación
// funcional; se puede ampliar módulo por módulo sin tocar los demás.
// ============================================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const estado = {
  usuario: null,
  perfil: null,
  clientes: [],
  vehiculos: [],
  servicios: [],
  categorias: [],
  cotizacionActualId: null,
  conceptosEnEdicion: [],
};

// ---------------------------------------------------------------------------
// Utilidades generales
// ---------------------------------------------------------------------------
function money(n) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function el(id) { return document.getElementById(id); }
function mostrarMensaje(idContenedor, texto, tipo = "ok") {
  const c = el(idContenedor);
  if (!c) return;
  c.innerHTML = `<div class="mensaje ${tipo}">${texto}</div>`;
  setTimeout(() => { c.innerHTML = ""; }, 4000);
}
async function registrarBitacora(tabla, registroId, accion, anteriores, nuevos) {
  try {
    await sb.from("bitacora").insert({
      tabla_afectada: tabla,
      registro_id: registroId,
      accion,
      valores_anteriores: anteriores || null,
      valores_nuevos: nuevos || null,
      usuario_id: estado.usuario ? estado.usuario.id : null,
    });
  } catch (e) { console.warn("No se pudo escribir bitácora:", e); }
}
function abrirModal(id) { el(id).classList.add("activo"); }
function cerrarModal(id) { el(id).classList.remove("activo"); }
document.querySelectorAll("[data-cerrar-modal]").forEach(b => {
  b.addEventListener("click", () => cerrarModal(b.dataset.cerrarModal));
});

const ETIQUETAS_COMERCIAL = {
  borrador: "Borrador", enviada: "Enviada", pendiente_autorizacion: "Pend. autorización",
  autorizada: "Autorizada", rechazada: "Rechazada", cancelada: "Cancelada", cerrada: "Cerrada",
};
const ETIQUETAS_SERVICIO = {
  sin_iniciar: "Sin iniciar", diagnostico: "Diagnóstico", esperando_refacciones: "Esperando refacciones",
  en_proceso: "En proceso", terminado: "Terminado", vehiculo_entregado: "Vehículo entregado",
};

// ============================================================================
// AUTENTICACIÓN
// ============================================================================
el("form-login").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  el("login-error").textContent = "";
  const correo = el("login-correo").value.trim();
  const clave = el("login-clave").value;
  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error) {
    el("login-error").textContent = "Usuario o contraseña incorrectos.";
    return;
  }
  await iniciarSesionExitosa(data.session);
});

el("btn-salir").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

async function iniciarSesionExitosa(session) {
  estado.usuario = session.user;
  const { data: perfil } = await sb.from("perfiles").select("*").eq("id", session.user.id).single();
  estado.perfil = perfil;

  el("pantalla-login").style.display = "none";
  el("app-shell").classList.add("activo");
  el("pie-usuario").textContent = (perfil && perfil.nombre_completo) || session.user.email;
  el("pie-rol").textContent = perfil ? `Rol: ${perfil.rol}` : "";

  if (perfil && perfil.rol === "administrador") {
    document.querySelectorAll("[data-admin-only]").forEach(n => n.style.display = "block");
  }

  await cargarDatosBase();
  cargarInicio();
}

async function verificarSesion() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    await iniciarSesionExitosa(data.session);
  }
}
verificarSesion();

// ============================================================================
// NAVEGACIÓN ENTRE MÓDULOS
// ============================================================================
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("activo"));
    item.classList.add("activo");
    document.querySelectorAll(".modulo").forEach(m => m.classList.remove("activo"));
    el("modulo-" + item.dataset.modulo).classList.add("activo");

    const cargas = {
      inicio: cargarInicio, cotizaciones: cargarCotizaciones, clientes: cargarClientes,
      vehiculos: cargarVehiculos, catalogo: cargarCatalogo, bitacora: cargarBitacora,
    };
    if (cargas[item.dataset.modulo]) cargas[item.dataset.modulo]();
  });
});

// Datos que varios módulos necesitan (selects de cliente/vehículo/categoría)
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
  llenarSelect("cliente", "cotizacion-cliente");
  llenarSelectCategorias();
}
function llenarSelect(tipo, idSelect) {
  const sel = el(idSelect);
  if (!sel) return;
  const lista = tipo === "cliente" ? estado.clientes : [];
  sel.innerHTML = `<option value="">Selecciona…</option>` + lista.map(c => `<option value="${c.id}">${c.nombre_completo}</option>`).join("");
}
function llenarSelectCategorias() {
  const sel = el("servicio-categoria");
  if (!sel) return;
  sel.innerHTML = `<option value="">Sin categoría</option>` + estado.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
}
function vehiculosDeCliente(clienteId) {
  return estado.vehiculos.filter(v => v.cliente_id === clienteId);
}
el("cotizacion-cliente").addEventListener("change", () => {
  const sel = el("cotizacion-vehiculo");
  const lista = vehiculosDeCliente(el("cotizacion-cliente").value);
  sel.innerHTML = `<option value="">Selecciona…</option>` + lista.map(v => `<option value="${v.id}">${v.placa} · ${v.marca} ${v.modelo}</option>`).join("");
});

// ============================================================================
// MÓDULO: INICIO / DASHBOARD
// ============================================================================
async function cargarInicio() {
  const { data: cots } = await sb.from("cotizaciones")
    .select("*, clientes(nombre_completo), vehiculos(placa)")
    .order("created_at", { ascending: false })
    .limit(300);

  const lista = cots || [];
  const abiertas = lista.filter(c => c.estado_comercial !== "cerrada" && c.estado_comercial !== "cancelada" && c.estado_comercial !== "rechazada");
  const pendientesAutorizacion = lista.filter(c => c.estado_comercial === "pendiente_autorizacion");
  const enProceso = lista.filter(c => c.estado_servicio === "en_proceso");
  const conSaldo = lista.filter(c => c.estado_pago !== "pagada" && c.estado_pago !== "saldo_a_favor" && c.total > 0);

  const kpis = el("kpis-inicio").querySelectorAll(".valor");
  kpis[0].textContent = abiertas.length;
  kpis[1].textContent = pendientesAutorizacion.length;
  kpis[2].textContent = enProceso.length;
  kpis[3].textContent = conSaldo.length;

  const filas = lista.slice(0, 12).map(c => `
    <tr>
      <td>${c.folio}</td>
      <td>${c.vehiculos ? c.vehiculos.placa : "—"}</td>
      <td>${c.clientes ? c.clientes.nombre_completo : "—"}</td>
      <td>$${money(c.total)}</td>
      <td>${badgeComercial(c.estado_comercial)}</td>
      <td>${c.fecha || ""}</td>
    </tr>`).join("");
  el("tabla-actividad-reciente").innerHTML = filas || `<tr><td colspan="6" class="vacio-tabla">Sin cotizaciones todavía.</td></tr>`;
}

function badgeComercial(estadoValor) {
  const colores = {
    borrador: "gris", enviada: "naranja", pendiente_autorizacion: "naranja",
    autorizada: "verde", rechazada: "rojo", cancelada: "rojo", cerrada: "gris",
  };
  return `<span class="badge ${colores[estadoValor] || "gris"}">${ETIQUETAS_COMERCIAL[estadoValor] || estadoValor}</span>`;
}
function badgeServicio(estadoValor) {
  return `<span class="badge">${ETIQUETAS_SERVICIO[estadoValor] || estadoValor}</span>`;
}

// ============================================================================
// MÓDULO: CLIENTES
// ============================================================================
async function cargarClientes(filtro = "") {
  let q = sb.from("clientes").select("*, vehiculos(id)").order("nombre_completo");
  const { data } = await q;
  let lista = data || [];
  if (filtro) {
    const f = filtro.toLowerCase();
    lista = lista.filter(c =>
      (c.nombre_completo || "").toLowerCase().includes(f) ||
      (c.telefono || "").includes(f) ||
      (c.correo || "").toLowerCase().includes(f));
  }
  el("tabla-clientes").innerHTML = lista.length ? lista.map(c => `
    <tr>
      <td>${c.nombre_completo}</td>
      <td>${c.telefono || "—"}</td>
      <td>${c.correo || "—"}</td>
      <td>${(c.vehiculos || []).length}</td>
      <td><button class="btn secundario pequeno" data-editar-cliente="${c.id}">Editar</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="vacio-tabla">Sin clientes registrados. Da de alta el primero.</td></tr>`;

  document.querySelectorAll("[data-editar-cliente]").forEach(b => {
    b.addEventListener("click", () => abrirModalCliente(lista.find(c => c.id === b.dataset.editarCliente)));
  });
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
  const registro = {
    nombre_completo: el("cliente-nombre").value.trim(),
    telefono: el("cliente-telefono").value.trim() || null,
    correo: el("cliente-correo").value.trim() || null,
    rfc: el("cliente-rfc").value.trim() || null,
    direccion: el("cliente-direccion").value.trim() || null,
    observaciones: el("cliente-observaciones").value.trim() || null,
  };
  let error, data;
  if (id) {
    ({ data, error } = await sb.from("clientes").update(registro).eq("id", id).select().single());
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
// MÓDULO: VEHÍCULOS
// ============================================================================
function normalizarPlaca(p) { return (p || "").toUpperCase().replace(/[\s-]/g, ""); }

async function cargarVehiculos(filtro = "") {
  const { data } = await sb.from("vehiculos").select("*, clientes(nombre_completo)").order("placa");
  let lista = data || [];
  if (filtro) {
    const f = normalizarPlaca(filtro) || filtro.toLowerCase();
    lista = lista.filter(v =>
      normalizarPlaca(v.placa).includes(normalizarPlaca(filtro)) ||
      (v.vin || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (v.marca || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (v.modelo || "").toLowerCase().includes(filtro.toLowerCase()));
  }
  el("tabla-vehiculos").innerHTML = lista.length ? lista.map(v => `
    <tr>
      <td><strong>${v.placa}</strong></td>
      <td>${v.marca} ${v.modelo}</td>
      <td>${v.anio || "—"}</td>
      <td>${v.clientes ? v.clientes.nombre_completo : "—"}</td>
      <td>${v.kilometraje_actual != null ? v.kilometraje_actual.toLocaleString("es-MX") : "—"}</td>
      <td>
        <button class="btn secundario pequeno" data-historial="${v.id}">Historial</button>
        <button class="btn secundario pequeno" data-editar-vehiculo="${v.id}">Editar</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="6" class="vacio-tabla">Sin vehículos registrados.</td></tr>`;

  document.querySelectorAll("[data-editar-vehiculo]").forEach(b => {
    b.addEventListener("click", () => abrirModalVehiculo(lista.find(v => v.id === b.dataset.editarVehiculo)));
  });
  document.querySelectorAll("[data-historial]").forEach(b => {
    b.addEventListener("click", () => verHistorialVehiculo(b.dataset.historial));
  });
}
el("buscar-vehiculo").addEventListener("input", (e) => cargarVehiculos(e.target.value));

el("btn-nuevo-vehiculo").addEventListener("click", () => abrirModalVehiculo(null));
function abrirModalVehiculo(v) {
  el("titulo-modal-vehiculo").textContent = v ? "Editar vehículo" : "Nuevo vehículo";
  el("vehiculo-id").value = v ? v.id : "";
  el("vehiculo-cliente").value = v ? v.cliente_id : "";
  el("vehiculo-placa").value = v ? v.placa : "";
  el("vehiculo-vin").value = v ? v.vin || "" : "";
  el("vehiculo-marca").value = v ? v.marca : "";
  el("vehiculo-modelo").value = v ? v.modelo : "";
  el("vehiculo-anio").value = v ? v.anio || "" : "";
  el("vehiculo-motor").value = v ? v.motor || "" : "";
  el("vehiculo-combustible").value = v ? v.combustible || "" : "";
  el("vehiculo-color").value = v ? v.color || "" : "";
  el("vehiculo-km").value = v ? v.kilometraje_actual || "" : "";
  abrirModal("modal-vehiculo");
}
el("form-vehiculo").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = el("vehiculo-id").value;
  const registro = {
    cliente_id: el("vehiculo-cliente").value,
    placa: el("vehiculo-placa").value.trim().toUpperCase(),
    vin: el("vehiculo-vin").value.trim() || null,
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
    ({ data, error } = await sb.from("vehiculos").update(registro).eq("id", id).select().single());
    if (!error) await registrarBitacora("vehiculos", id, "actualizar", null, registro);
  } else {
    registro.created_by = estado.usuario.id;
    ({ data, error } = await sb.from("vehiculos").insert(registro).select().single());
    if (!error) await registrarBitacora("vehiculos", data.id, "crear", null, registro);
  }
  if (error) { mostrarMensaje("mensaje-vehiculo", "Error al guardar: " + error.message, "error"); return; }
  cerrarModal("modal-vehiculo");
  await cargarDatosBase();
  cargarVehiculos();
});

async function verHistorialVehiculo(vehiculoId) {
  const { data: cots } = await sb.from("cotizaciones")
    .select("*, clientes(nombre_completo)")
    .eq("vehiculo_id", vehiculoId)
    .order("fecha", { ascending: false });
  const v = estado.vehiculos.find(x => x.id === vehiculoId);
  const resumen = (cots || []).map(c =>
    `${c.folio} · ${c.fecha} · $${money(c.total)} · ${ETIQUETAS_COMERCIAL[c.estado_comercial]}`
  ).join("\n") || "Sin cotizaciones registradas para este vehículo.";
  alert(`Historial de ${v ? v.placa : ""}\n\n${resumen}`);
  // Nota: en una siguiente iteración esto se reemplaza por una vista dedicada
  // con línea de tiempo, pagos y notas — aquí queda el gancho de datos listo.
}

// ============================================================================
// MÓDULO: CATÁLOGO DE SERVICIOS
// ============================================================================
async function cargarCatalogo(filtro = "") {
  const { data } = await sb.from("servicios").select("*, categorias(nombre)").order("nombre");
  let lista = data || [];
  if (filtro) {
    const f = filtro.toLowerCase();
    lista = lista.filter(s => (s.codigo || "").toLowerCase().includes(f) || (s.nombre || "").toLowerCase().includes(f));
  }
  el("tabla-catalogo").innerHTML = lista.length ? lista.map(s => `
    <tr>
      <td>${s.codigo}</td>
      <td>${s.nombre}</td>
      <td>${s.categorias ? s.categorias.nombre : "—"}</td>
      <td>$${money(s.precio_venta)}</td>
      <td><span class="badge ${s.estado === 'activo' ? 'verde' : 'gris'}">${s.estado}</span></td>
      <td><button class="btn secundario pequeno" data-editar-servicio="${s.id}">Editar</button></td>
    </tr>`).join("") : `<tr><td colspan="6" class="vacio-tabla">Catálogo vacío. Agrega un servicio o usa la importación masiva.</td></tr>`;

  document.querySelectorAll("[data-editar-servicio]").forEach(b => {
    b.addEventListener("click", () => abrirModalServicio(lista.find(s => s.id === b.dataset.editarServicio)));
  });
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
  if (!estado.perfil || estado.perfil.rol !== "administrador") {
    mostrarMensaje("mensaje-servicio", "Solo un administrador puede modificar el catálogo.", "error");
    return;
  }
  const id = el("servicio-id").value;
  const registro = {
    codigo: el("servicio-codigo").value.trim(),
    nombre: el("servicio-nombre").value.trim(),
    categoria_id: el("servicio-categoria").value || null,
    unidad_medida: el("servicio-unidad").value.trim() || "servicio",
    precio_venta: Number(el("servicio-precio").value || 0),
    costo_interno: el("servicio-costo").value ? Number(el("servicio-costo").value) : null,
    impuesto: Number(el("servicio-impuesto").value || 0),
    estado: el("servicio-estado").value,
    descripcion: el("servicio-descripcion").value.trim() || null,
  };
  let error;
  if (id) {
    ({ error } = await sb.from("servicios").update(registro).eq("id", id));
    if (!error) await registrarBitacora("servicios", id, "actualizar", null, registro);
  } else {
    const { data, error: err2 } = await sb.from("servicios").insert(registro).select().single();
    error = err2;
    if (!error) await registrarBitacora("servicios", data.id, "crear", null, registro);
  }
  if (error) { mostrarMensaje("mensaje-servicio", "Error al guardar: " + error.message, "error"); return; }
  cerrarModal("modal-servicio");
  await cargarDatosBase();
  cargarCatalogo();
});

// ============================================================================
// MÓDULO: COTIZACIONES
// ============================================================================
async function cargarCotizaciones() {
  const { data } = await sb.from("cotizaciones")
    .select("*, clientes(nombre_completo), vehiculos(placa, marca, modelo)")
    .order("created_at", { ascending: false });
  aplicarFiltrosCotizaciones(data || []);
}
function aplicarFiltrosCotizaciones(listaCompleta) {
  const texto = el("buscar-cotizacion").value.toLowerCase();
  const estadoFiltro = el("filtro-estado-comercial").value;
  let lista = listaCompleta;
  if (texto) {
    lista = lista.filter(c =>
      c.folio.toLowerCase().includes(texto) ||
      (c.vehiculos && c.vehiculos.placa.toLowerCase().includes(texto)) ||
      (c.clientes && c.clientes.nombre_completo.toLowerCase().includes(texto)));
  }
  if (estadoFiltro) lista = lista.filter(c => c.estado_comercial === estadoFiltro);

  el("tabla-cotizaciones").innerHTML = lista.length ? lista.map(c => `
    <tr>
      <td>${c.folio}</td>
      <td>${c.clientes ? c.clientes.nombre_completo : "—"}</td>
      <td>${c.vehiculos ? c.vehiculos.placa + " · " + c.vehiculos.marca + " " + c.vehiculos.modelo : "—"}</td>
      <td>$${money(c.total)}</td>
      <td>—</td>
      <td>${badgeComercial(c.estado_comercial)}</td>
      <td>${badgeServicio(c.estado_servicio)}</td>
      <td><button class="btn secundario pequeno" data-abrir-cotizacion="${c.id}">Abrir</button></td>
    </tr>`).join("") : `<tr><td colspan="8" class="vacio-tabla">Todavía no hay cotizaciones.</td></tr>`;

  document.querySelectorAll("[data-abrir-cotizacion]").forEach(b => {
    b.addEventListener("click", () => abrirCotizacion(b.dataset.abrirCotizacion));
  });
  window.__cotizacionesCache = listaCompleta;
}
el("buscar-cotizacion").addEventListener("input", () => aplicarFiltrosCotizaciones(window.__cotizacionesCache || []));
el("filtro-estado-comercial").addEventListener("change", () => aplicarFiltrosCotizaciones(window.__cotizacionesCache || []));

// --- Pestañas del modal de cotización ---
document.querySelectorAll(".pestana").forEach(p => {
  p.addEventListener("click", () => {
    document.querySelectorAll(".pestana").forEach(x => x.classList.remove("activa"));
    p.classList.add("activa");
    ["datos", "pagos", "seguimiento"].forEach(nombre => {
      el("pestana-" + nombre).style.display = nombre === p.dataset.pestana ? "block" : "none";
    });
  });
});

el("btn-nueva-cotizacion").addEventListener("click", () => abrirCotizacion(null));

async function abrirCotizacion(id) {
  estado.cotizacionActualId = id;
  el("titulo-modal-cotizacion").textContent = id ? "Cotización" : "Nueva cotización";
  el("cotizacion-id").value = id || "";
  document.querySelector('.pestana[data-pestana="datos"]').click();

  el("cotizacion-cliente").value = "";
  el("cotizacion-vehiculo").innerHTML = `<option value="">Selecciona…</option>`;
  el("cotizacion-entrega").value = "";
  el("cotizacion-km").value = "";
  el("cotizacion-observaciones").value = "";
  el("cotizacion-estado-comercial").value = "borrador";
  el("cotizacion-estado-servicio").value = "sin_iniciar";
  estado.conceptosEnEdicion = [];
  el("tabla-pagos-cotizacion").innerHTML = "";
  el("lista-seguimiento").innerHTML = "";

  if (id) {
    const { data: c } = await sb.from("cotizaciones").select("*").eq("id", id).single();
    el("cotizacion-cliente").value = c.cliente_id;
    el("cotizacion-vehiculo").innerHTML = vehiculosDeCliente(c.cliente_id)
      .map(v => `<option value="${v.id}">${v.placa} · ${v.marca} ${v.modelo}</option>`).join("");
    el("cotizacion-vehiculo").value = c.vehiculo_id;
    el("cotizacion-entrega").value = c.entrega_estimada || "";
    el("cotizacion-km").value = c.kilometraje_visita || "";
    el("cotizacion-observaciones").value = c.observaciones || "";
    el("cotizacion-estado-comercial").value = c.estado_comercial;
    el("cotizacion-estado-servicio").value = c.estado_servicio;

    const { data: detalle } = await sb.from("detalle_cotizacion").select("*").eq("cotizacion_id", id).order("created_at");
    estado.conceptosEnEdicion = (detalle || []).map(d => ({ ...d }));

    await cargarPagosCotizacion(id);
    await cargarSeguimientoCotizacion(id);
  }
  renderConceptos();
  abrirModal("modal-cotizacion");
}

function renderConceptos() {
  el("cuerpo-conceptos").innerHTML = estado.conceptosEnEdicion.map((cpt, i) => `
    <tr>
      <td>
        <select data-campo="tipo" data-i="${i}">
          ${["servicio","mano_obra","consumible","refaccion_libre","descuento","nota"].map(t =>
            `<option value="${t}" ${cpt.tipo === t ? "selected" : ""}>${t.replace("_"," ")}</option>`).join("")}
        </select>
      </td>
      <td><input data-campo="descripcion" data-i="${i}" value="${(cpt.descripcion || "").replace(/"/g, '&quot;')}"></td>
      <td><input type="number" step="0.01" data-campo="cantidad" data-i="${i}" value="${cpt.cantidad || 1}"></td>
      <td><input type="number" step="0.01" data-campo="precio_unitario" data-i="${i}" value="${cpt.precio_unitario || 0}"></td>
      <td><input type="number" step="0.01" data-campo="descuento" data-i="${i}" value="${cpt.descuento || 0}"></td>
      <td>$${money(cpt.importe || 0)}</td>
      <td><button type="button" class="btn secundario pequeno" data-quitar="${i}">×</button></td>
    </tr>`).join("");

  el("cuerpo-conceptos").querySelectorAll("[data-campo]").forEach(input => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.i);
      const campo = input.dataset.campo;
      estado.conceptosEnEdicion[i][campo] = ["cantidad","precio_unitario","descuento"].includes(campo) ? Number(input.value || 0) : input.value;
      recalcularConcepto(i);
    });
  });
  el("cuerpo-conceptos").querySelectorAll("[data-quitar]").forEach(b => {
    b.addEventListener("click", () => { estado.conceptosEnEdicion.splice(Number(b.dataset.quitar), 1); renderConceptos(); recalcularTotales(); });
  });
  recalcularTotales();
}
function recalcularConcepto(i) {
  const c = estado.conceptosEnEdicion[i];
  c.importe = Math.max(0, (c.cantidad || 0) * (c.precio_unitario || 0) - (c.descuento || 0));
  recalcularTotales();
}
function recalcularTotales() {
  const subtotal = estado.conceptosEnEdicion.reduce((s, c) => s + (c.cantidad || 0) * (c.precio_unitario || 0), 0);
  const descuento = estado.conceptosEnEdicion.reduce((s, c) => s + (c.descuento || 0), 0);
  const total = Math.max(0, subtotal - descuento);
  el("cotizacion-subtotal").textContent = money(subtotal);
  el("cotizacion-descuento").textContent = money(descuento);
  el("cotizacion-total").textContent = money(total);
}
el("btn-agregar-concepto").addEventListener("click", () => {
  estado.conceptosEnEdicion.push({ tipo: "servicio", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0, importe: 0 });
  renderConceptos();
});

el("btn-guardar-cotizacion").addEventListener("click", async () => {
  const clienteId = el("cotizacion-cliente").value;
  const vehiculoId = el("cotizacion-vehiculo").value;
  if (!clienteId || !vehiculoId) {
    mostrarMensaje("mensaje-cotizacion", "Selecciona cliente y vehículo.", "error");
    return;
  }
  const subtotal = estado.conceptosEnEdicion.reduce((s, c) => s + (c.cantidad || 0) * (c.precio_unitario || 0), 0);
  const descuento = estado.conceptosEnEdicion.reduce((s, c) => s + (c.descuento || 0), 0);
  const total = Math.max(0, subtotal - descuento);

  const encabezado = {
    cliente_id: clienteId,
    vehiculo_id: vehiculoId,
    entrega_estimada: el("cotizacion-entrega").value || null,
    kilometraje_visita: el("cotizacion-km").value ? Number(el("cotizacion-km").value) : null,
    observaciones: el("cotizacion-observaciones").value.trim() || null,
    estado_comercial: el("cotizacion-estado-comercial").value,
    estado_servicio: el("cotizacion-estado-servicio").value,
    subtotal, descuento_total: descuento, total,
  };

  let id = el("cotizacion-id").value;
  if (!id) {
    const { data: folioData } = await sb.rpc("siguiente_folio");
    encabezado.folio = folioData;
    encabezado.usuario_responsable = estado.usuario.id;
    encabezado.created_by = estado.usuario.id;
    const { data, error } = await sb.from("cotizaciones").insert(encabezado).select().single();
    if (error) { mostrarMensaje("mensaje-cotizacion", "Error al crear: " + error.message, "error"); return; }
    id = data.id;
    el("cotizacion-id").value = id;
    await registrarBitacora("cotizaciones", id, "crear", null, encabezado);
  } else {
    const { error } = await sb.from("cotizaciones").update(encabezado).eq("id", id);
    if (error) { mostrarMensaje("mensaje-cotizacion", "Error al actualizar: " + error.message, "error"); return; }
    await registrarBitacora("cotizaciones", id, "actualizar", null, encabezado);
  }

  // Reemplaza el detalle completo (simple para el esqueleto MVP)
  await sb.from("detalle_cotizacion").delete().eq("cotizacion_id", id);
  if (estado.conceptosEnEdicion.length) {
    const filas = estado.conceptosEnEdicion.map(c => ({
      cotizacion_id: id, tipo: c.tipo, descripcion: c.descripcion,
      cantidad: c.cantidad || 1, precio_unitario: c.precio_unitario || 0,
      descuento: c.descuento || 0, importe: c.importe || 0,
    }));
    await sb.from("detalle_cotizacion").insert(filas);
  }

  mostrarMensaje("mensaje-cotizacion", "Cotización guardada correctamente.");
  await cargarCotizaciones();
});

// --- Pagos dentro de la cotización ---
async function cargarPagosCotizacion(cotizacionId) {
  const { data: pagos } = await sb.from("pagos").select("*").eq("cotizacion_id", cotizacionId).order("fecha");
  const { data: cot } = await sb.from("cotizaciones").select("total").eq("id", cotizacionId).single();
  const pagosValidos = (pagos || []).filter(p => p.estado === "valido");
  const saldo = (cot ? cot.total : 0) - pagosValidos.reduce((s, p) => s + Number(p.importe), 0);
  el("cotizacion-saldo").textContent = money(saldo);
  el("tabla-pagos-cotizacion").innerHTML = (pagos || []).map(p => `
    <tr>
      <td>${p.fecha}</td>
      <td>$${money(p.importe)}</td>
      <td>${p.metodo}</td>
      <td>${p.referencia || "—"}</td>
      <td><span class="badge ${p.estado === 'valido' ? 'verde' : 'rojo'}">${p.estado}</span></td>
      <td>${p.estado === 'valido' ? `<button class="btn secundario pequeno" data-reversar="${p.id}">Reversar</button>` : ""}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="vacio-tabla">Sin pagos registrados.</td></tr>`;

  document.querySelectorAll("[data-reversar]").forEach(b => {
    b.addEventListener("click", async () => {
      const motivo = prompt("Motivo de la reversión (obligatorio):");
      if (!motivo) return;
      await sb.from("pagos").update({ estado: "reversado" }).eq("id", b.dataset.reversar);
      await registrarBitacora("pagos", b.dataset.reversar, "reversar", null, { motivo });
      cargarPagosCotizacion(cotizacionId);
    });
  });
}
el("btn-agregar-pago").addEventListener("click", async () => {
  const id = el("cotizacion-id").value;
  if (!id) { mostrarMensaje("mensaje-cotizacion", "Guarda la cotización antes de registrar pagos.", "error"); return; }
  const importe = Number(el("pago-importe").value || 0);
  if (importe <= 0) return;
  const registro = {
    cotizacion_id: id, importe, metodo: el("pago-metodo").value,
    referencia: el("pago-referencia").value.trim() || null,
    comentario: el("pago-comentario").value.trim() || null,
    usuario_id: estado.usuario.id,
  };
  const { data, error } = await sb.from("pagos").insert(registro).select().single();
  if (error) { alert("Error al registrar pago: " + error.message); return; }
  await registrarBitacora("pagos", data.id, "crear", null, registro);
  el("pago-importe").value = ""; el("pago-referencia").value = ""; el("pago-comentario").value = "";
  cargarPagosCotizacion(id);
});

// --- Seguimiento dentro de la cotización ---
async function cargarSeguimientoCotizacion(cotizacionId) {
  const { data } = await sb.from("seguimientos").select("*").eq("cotizacion_id", cotizacionId).order("created_at", { ascending: false });
  el("lista-seguimiento").innerHTML = (data || []).map(s => `
    <li>${s.descripcion}<div class="meta">${new Date(s.created_at).toLocaleString("es-MX")}</div></li>`).join("")
    || `<li class="meta">Sin movimientos registrados todavía.</li>`;
}
el("btn-agregar-seguimiento").addEventListener("click", async () => {
  const id = el("cotizacion-id").value;
  const texto = el("seguimiento-texto").value.trim();
  if (!id) { mostrarMensaje("mensaje-cotizacion", "Guarda la cotización antes de agregar seguimiento.", "error"); return; }
  if (!texto) return;
  await sb.from("seguimientos").insert({ cotizacion_id: id, descripcion: texto, usuario_id: estado.usuario.id, tipo: "nota" });
  el("seguimiento-texto").value = "";
  cargarSeguimientoCotizacion(id);
});

// ============================================================================
// MÓDULO: IMPORTACIÓN MASIVA (CSV simple para el esqueleto)
// ============================================================================
el("input-importar").addEventListener("change", async (ev) => {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  const texto = await archivo.text();
  const filas = parseCSV(texto);
  if (!filas.length) { mostrarMensaje("mensaje-importacion", "El archivo está vacío.", "error"); return; }

  const encabezados = filas[0].map(h => h.trim().toLowerCase());
  const requeridos = ["codigo", "nombre", "categoria", "unidad_medida", "precio_venta", "estado"];
  const faltantes = requeridos.filter(r => !encabezados.includes(r));
  if (faltantes.length) {
    mostrarMensaje("mensaje-importacion", "Faltan columnas obligatorias: " + faltantes.join(", "), "error");
    return;
  }

  const registros = filas.slice(1).filter(f => f.some(c => c.trim() !== "")).map(f => {
    const obj = {};
    encabezados.forEach((h, i) => obj[h] = (f[i] || "").trim());
    return obj;
  });

  let previa = `<table class="tabla" style="margin-top:12px;"><thead><tr><th>Código</th><th>Nombre</th><th>Precio</th><th>Estado en catálogo</th></tr></thead><tbody>`;
  const codigosExistentes = new Set(estado.servicios.map(s => s.codigo));
  registros.forEach(r => {
    previa += `<tr><td>${r.codigo}</td><td>${r.nombre}</td><td>$${r.precio_venta}</td><td>${codigosExistentes.has(r.codigo) ? "Actualiza existente" : "Nuevo"}</td></tr>`;
  });
  previa += `</tbody></table><button class="btn" id="btn-confirmar-importacion" style="margin-top:12px;">Aplicar ${registros.length} registro(s)</button>`;
  el("previa-importacion").innerHTML = previa;

  el("btn-confirmar-importacion").addEventListener("click", async () => {
    if (!estado.perfil || estado.perfil.rol !== "administrador") {
      mostrarMensaje("mensaje-importacion", "Solo un administrador puede aplicar importaciones.", "error");
      return;
    }
    let nuevos = 0, actualizados = 0, errores = 0;
    for (const r of registros) {
      const registro = {
        codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion || null,
        unidad_medida: r.unidad_medida || "servicio",
        precio_venta: Number(r.precio_venta || 0),
        costo_interno: r.costo_interno ? Number(r.costo_interno) : null,
        impuesto: r.impuesto ? Number(r.impuesto) : 0,
        estado: r.estado || "activo",
        observaciones: r.observaciones || null,
      };
      const { error } = await sb.from("servicios").upsert(registro, { onConflict: "codigo" });
      if (error) { errores++; continue; }
      codigosExistentes.has(r.codigo) ? actualizados++ : nuevos++;
    }
    const resumen = { total: registros.length, nuevos, actualizados, errores };
    await sb.from("importaciones").insert({ archivo_nombre: archivo.name, resumen, usuario_id: estado.usuario.id });
    await registrarBitacora("servicios", null, "importacion_masiva", null, resumen);
    mostrarMensaje("mensaje-importacion", `Importación aplicada: ${nuevos} nuevos, ${actualizados} actualizados, ${errores} con error.`);
    el("previa-importacion").innerHTML = "";
    el("input-importar").value = "";
    await cargarDatosBase();
  });
});
function parseCSV(texto) {
  return texto.trim().split(/\r?\n/).map(linea => linea.split(",").map(c => c.trim()));
}

// ============================================================================
// MÓDULO: BITÁCORA
// ============================================================================
async function cargarBitacora() {
  const { data } = await sb.from("bitacora").select("*").order("created_at", { ascending: false }).limit(100);
  el("tabla-bitacora").innerHTML = (data || []).map(b => `
    <tr>
      <td>${new Date(b.created_at).toLocaleString("es-MX")}</td>
      <td>${b.tabla_afectada}</td>
      <td>${b.accion}</td>
      <td>${b.valores_nuevos ? JSON.stringify(b.valores_nuevos).slice(0, 120) : "—"}</td>
    </tr>`).join("") || `<tr><td colspan="4" class="vacio-tabla">Sin actividad registrada todavía.</td></tr>`;
}
