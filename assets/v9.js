// Sistema Taller Automotriz · assets/v9.js · corrección V11.1
// Sustituye la lógica de alta del bloque HERRAMIENTA ESPECIAL por esta versión.
// Genera codigo antes del INSERT para cumplir NOT NULL y actualiza la UI.

function generarCodigoHerramientaV11() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'HER-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  }
  return 'HER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
}

$('v9-guardar-herr')?.addEventListener('click', async () => {
  limpiarMensajeV11('v11-herr-mensaje');

  const id = $('v11-herr-id')?.value || '';
  const nombre = $('v9-herr-nombre')?.value.trim() || '';
  const serie = $('v11-herr-serie')?.value.trim() || '';

  if (!nombre) {
    mostrarErrorV11('v11-herr-mensaje', null, 'El nombre de la herramienta es obligatorio.');
    return;
  }
  if (!serie) {
    mostrarErrorV11('v11-herr-mensaje', null, 'El número de serie es obligatorio.');
    return;
  }

  const boton = $('v9-guardar-herr');
  const original = boton?.textContent || 'Guardar';
  if (boton) { boton.disabled = true; boton.textContent = 'Guardando...'; }

  try {
    const actual = id ? (window.v9Herr || []).find(x => String(x.id) === String(id)) : null;

    // Se compilan los datos capturados del formulario
    const registro = {
      nombre,
      observaciones: $('v9-herr-obs')?.value.trim() || null
    };

    if (actual) {
      // Lógica de Edición / UPDATE
      const candidatos = {
        numero_serie: serie,
        serie,
        marca: $('v11-herr-marca')?.value.trim() || null,
        modelo: $('v11-herr-modelo')?.value.trim() || null,
        ubicacion: $('v11-herr-ubicacion')?.value.trim() || null
      };

      for (const [k, v] of Object.entries(candidatos)) {
        if (Object.prototype.hasOwnProperty.call(actual, k)) registro[k] = v;
      }

      const { error } = await sb.from('herramientas_especiales').update(registro).eq('id', id);
      if (error) {
        mostrarErrorV11('v11-herr-mensaje', error, 'No fue posible actualizar la herramienta.');
        return;
      }
    } else {
      // Lógica de Creación / INSERT V11.1
      let codigo;

      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        codigo = 'HER-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
      } else {
        codigo = 'HER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
      }

      // Se asigna el código obligatorio al objeto que irá a la BD
      registro.codigo = codigo;

      // Se agregan los datos adicionales obligatorios/opcionales para el alta
      registro.numero_serie = serie;
      registro.serie = serie;
      registro.marca = $('v11-herr-marca')?.value.trim() || null;
      registro.modelo = $('v11-herr-modelo')?.value.trim() || null;
      registro.ubicacion = $('v11-herr-ubicacion')?.value.trim() || null;

      const { error } = await sb.from('herramientas_especiales').insert(registro);
      if (error) {
        mostrarErrorV11('v11-herr-mensaje', error, 'No fue posible registrar la herramienta.');
        return;
      }

      // Refleja el código en el input de la vista si existe en el DOM
      if ($('v9-herr-codigo')) {
        $('v9-herr-codigo').value = codigo;
      }
    }

    cerrarModal('modal-v9-herr');
    await cargarHerramientas();
    await dashboard();
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = original; }
  }
});
