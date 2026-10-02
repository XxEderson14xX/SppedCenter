import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper implementations mirroring frontend logic for isolated unit testing
function money(n) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fixFloat(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

function escHtml(v) {
  return String(v ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

function esAdicionalConcepto(c) {
  return !!(c && (c.codigo === "ADICIONAL" || /adicional autorizado/i.test(c.descripcion || "")));
}

function descripcionLimpiaAdicional(desc) {
  return String(desc || "").replace(/^\s*(?:🔧\s*)?adicional autorizado:\s*/i, "").trim();
}

function evaluarPasswordRules(valor) {
  const tieneLen = valor.length >= 8;
  const tieneMin = /[a-z]/.test(valor);
  const tieneMay = /[A-Z]/.test(valor);
  const tieneNum = /[0-9]/.test(valor);
  return tieneLen && tieneMin && tieneMay && tieneNum;
}

function recalcularTotalesConceptos(conceptos) {
  const subtotal = conceptos.reduce((s, c) => {
    const cant = Math.max(1, Math.floor(Number(c.cantidad) || 1));
    const precio = Math.min(999999999.99, Math.max(0, fixFloat(c.precio_unitario || 0)));
    return fixFloat(s + cant * precio);
  }, 0);

  const descuento = conceptos.reduce((s, c) => {
    const desc = Math.min(999999999.99, Math.max(0, fixFloat(c.descuento || 0)));
    return fixFloat(s + desc);
  }, 0);

  const total = Math.max(0, fixFloat(subtotal - descuento));
  const base = total / 1.16;
  const iva = total - base;
  const anticipo50 = total * 0.5;

  return { subtotal, descuento, total, base: fixFloat(base), iva: fixFloat(iva), anticipo50: fixFloat(anticipo50) };
}

describe('Suite de Pruebas: Utilidades de Formato y Seguridad HTML', () => {
  test('money() debe formatear montos en pesos mexicanos', () => {
    assert.equal(money(1250.5), '1,250.50');
    assert.equal(money(0), '0.00');
    assert.equal(money(null), '0.00');
  });

  test('fixFloat() debe corregir imprecisiones de punto flotante', () => {
    assert.equal(fixFloat(0.1 + 0.2), 0.3);
    assert.equal(fixFloat(100.005), 100.01);
    assert.equal(fixFloat(-50.222), -50.22);
  });

  test('escHtml() debe escapar XSS y caracteres de atributos HTML', () => {
    assert.equal(escHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escHtml("O'Connor & Company"), 'O&#39;Connor &amp; Company');
    assert.equal(escHtml(null), '');
    assert.equal(escHtml(undefined), '');
  });

  test('esAdicionalConcepto() debe identificar marcas de adicionales', () => {
    assert.equal(esAdicionalConcepto({ codigo: 'ADICIONAL', descripcion: 'Filtro aceite' }), true);
    assert.equal(esAdicionalConcepto({ descripcion: '🔧 Adicional autorizado: Balatas' }), true);
    assert.equal(esAdicionalConcepto({ codigo: 'SER-01', descripcion: 'Afinacion' }), false);
  });

  test('descripcionLimpiaAdicional() debe remover prefijo y emoji', () => {
    assert.equal(descripcionLimpiaAdicional('🔧 adicional autorizado: Bujias Iridium'), 'Bujias Iridium');
    assert.equal(descripcionLimpiaAdicional('Frenos delanteros'), 'Frenos delanteros');
  });
});

describe('Suite de Pruebas: Requisitos de Contraseñas y Validación de Usuarios', () => {
  test('evaluarPasswordRules() debe exigir 8+ caracteres, minúscula, mayúscula y número', () => {
    assert.equal(evaluarPasswordRules('Speed2026'), true);
    assert.equal(evaluarPasswordRules('weak'), false);
    assert.equal(evaluarPasswordRules('alllowercase1'), false);
    assert.equal(evaluarPasswordRules('ALLUPPERCASE1'), false);
    assert.equal(evaluarPasswordRules('NoDigitsHere'), false);
  });
});

describe('Suite de Pruebas: Cálculo de Totales, IVA y Anticipo 50%', () => {
  test('recalcularTotalesConceptos() calcula correctamente totales con 16% IVA y 50% anticipo', () => {
    const conceptos = [
      { cantidad: 2, precio_unitario: 500, descuento: 0 },
      { cantidad: 1, precio_unitario: 1000, descuento: 100 }
    ];
    const res = recalcularTotalesConceptos(conceptos);
    assert.equal(res.subtotal, 2000.00);
    assert.equal(res.descuento, 100.00);
    assert.equal(res.total, 1900.00);
    assert.equal(res.anticipo50, 950.00);
    assert.equal(fixFloat(res.base + res.iva), 1900.00);
  });

  test('Manejo de valores limite (negativos, ceros y desbordamientos)', () => {
    const conceptosNegativos = [
      { cantidad: -5, precio_unitario: -200, descuento: -50 }
    ];
    const res = recalcularTotalesConceptos(conceptosNegativos);
    assert.equal(res.subtotal, 0.00);
    assert.equal(res.total, 0.00);
  });
});

describe('Suite de Pruebas: Resiliencia de Async API Mocks', () => {
  test('Simulación de llamada exitosa a Supabase RPC', async () => {
    const mockSupabaseRpc = async (nombre, params) => {
      if (nombre === 'siguiente_folio') return { data: 'COT-2026-000001', error: null };
      return { data: null, error: new Error('RPC desconocido') };
    };

    const res = await mockSupabaseRpc('siguiente_folio');
    assert.equal(res.data, 'COT-2026-000001');
    assert.equal(res.error, null);
  });

  test('Simulación de error de red o timeout en Supabase RPC con try/catch', async () => {
    const mockFailingRpc = async () => {
      throw new TypeError('Failed to fetch (Network Error)');
    };

    let errorCapturado = null;
    try {
      await mockFailingRpc();
    } catch (e) {
      errorCapturado = e;
    }

    assert.notEqual(errorCapturado, null);
    assert.equal(errorCapturado.message, 'Failed to fetch (Network Error)');
  });
});
