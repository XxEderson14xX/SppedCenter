# Lenguaje de Diseño y Sistema Visual · SpeedCenter

Documentación extraída del código fuente, hojas de estilo, esquema de base de datos y documentación activa del proyecto **SpeedCenter (Sistema de Administración para Taller Automotriz · V12.0)**.

---

## 1. Identidad de Marca y Filosofía

- **Nombre Oficial**: SpeedCenter
- **Propósito**: Panel operativo de administración integral para taller automotriz (gestión de cotizaciones, órdenes de trabajo, clientes, vehículos con historial permanente, inventario de herramientas especiales, prospectos e ingresos).
- **Subtítulos y Copy Oficial**:
  - *"Panel operativo · V12.0"*
  - *"Inicia sesión con tu usuario o correo"*
  - *"Vista general del taller"*
  - *"Ciclo completo: crear, autorizar, dar seguimiento y cerrar"*
  - *"Trabajos autorizados, técnico y avance por checks"*
  - *"Control V11 de inventario, custodia, disponibilidad e historial"*
- **Principios de Diseño**:
  - **Ergonomía Visual**: Colores neutros en áreas de trabajo extensas para evitar fatiga en jornadas de 8 horas; rojo de marca reservado para botones principales, selección activa y acentos de identidad ("racing stripe").
  - **Claridad de Alerta vs. Identidad**: El rojo de marca (`#D32F2F`) es deliberadamente distinto al rojo de error/peligro (`#C0392B` / `#fdecea`) para evitar confusiones de usabilidad.
  - **Cero Relleno / Cero Placeholders**: Toda interfaz se construye sobre datos reales (placas, VIN, folios `COT-YYYY-XXXXXX`, códigos `HER-XXXXXXXXXXXX`, checklist de avances y totalizaciones en pesos mexicanos).

---

## 2. Forma Nativa del Producto y Flujo del Taller

El sistema no utiliza plantillas de secciones genéricas. Su estructura responde directamente al pipeline operativo del taller automotriz:

```
[Prospecto / Recepción]
       │
       ▼
[Cotización] ──► (Borrador ➔ Enviada ➔ Pendiente de autorización ➔ Autorizada)
       │
       ▼
[Orden de Trabajo] ──► (Técnico asignado + Checklist de avance + Refacciones asignadas)
       │
       ▼
[Ejecución & Herramientas] ──► (Custodia de Herramienta Especial HER-XXXXXXXXXXXX)
       │
       ▼
[Pagos & Cierre] ──► (50% Anticipo requerido, IVA 16%, Pago total / Cierre con adeudo)
       │
       ▼
[Historial Permanente] ──► (Anclado a VIN/NIV del auto e ID de Cliente)
```

### Reglas de Oro de Identidad de Datos
- **Cliente**: Identidad permanente anclada a `uuid` interno. Teléfono y correo admiten cambios conservando historial (`telefonos_historial`).
- **Vehículo**: Identidad permanente anclada al **VIN / NIV** (17 caracteres). Las placas son volátiles y se registran en `placas_historial`.

---

## 3. Design Tokens (CSS Variables)

Definidos en `assets/styles.css`:

```css
:root {
  /* Identidad SpeedCenter */
  --navy: #211E1E;          /* Gris carbón cálido · menú lateral y encabezados oscuros */
  --navy-2: #2B2727;        /* Variante clara · hover sobre oscuro */
  --teal: #D32F2F;          /* Rojo SpeedCenter · botón principal y acento activo */
  --teal-2: #B71C1C;        /* Rojo oscuro · hover de botón principal */
  --bg: #F4F6F8;            /* Fondo de trabajo (gris niebla) */
  --panel: #ffffff;         /* Fondo de tarjetas y paneles */
  --border: #e2e8f0;        /* Bordes de contenedores e inputs */
  --text: #1e2833;          /* Texto principal */
  --text-mute: #64748b;     /* Texto secundario y etiquetas */

  /* Indicadores y Estados */
  --green: #16a34a;         /* Éxito / Badges activos (WCAG AA) */
  --red: #C0392B;           /* Alertas y botones de peligro */
  --orange: #d98c00;        /* Pendiente / Advertencia */
  --azul: #1b6f7a;          /* Informativo / Chips seleccionados */
  --gris: #64748b;          /* Neutro / Desactivado */
  --racing-stripe: #D32F2F; /* Franja de acento superior en paneles */

  /* Focus & Elevación */
  --focus-ring: 0 0 0 3px rgba(211, 47, 47, 0.25);
  --sombra-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --sombra: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --sombra-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --sombra-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --sombra-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);

  /* Bordes & Transiciones */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --transition-fast: all 0.15s ease-in-out;
  --transition-normal: all 0.2s ease-in-out;
}
```

---

## 4. Tipografía y Escalas

- **Familia Tipográfica**: `"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif`
- **Cuerpo Base**: `14px`, `line-height: 1.5`, color `--text` (`#1e2833`).
- **Encabezados**:
  - `h1`: `24px` (Tarjeta de Login / Pantalla Principal), `font-weight: 700`, `letter-spacing: -0.01em`.
  - `h2`: `22px` (Encabezados de módulo), `font-weight: 700`, color `--navy`.
  - `h3`: `16px` – `19px` (Títulos de paneles y modales), `font-weight: 700`.
- **Textos Secundarios / Ayudas**: `12px` – `13px`, color `--text-mute` (`#64748b`).

---

## 5. Patrones de Componentes UI

### A. Navegación Shell (`#app-shell`)
- **Menú Lateral Fijo (`#nav-lateral`)**:
  - Ancho: `250px`, fondo `--navy` (`#211E1E`), texto `#cdd6e0`.
  - Logo SpeedCenter funcional como botón direct a Inicio.
  - Ítems (`.nav-item`): transición hover con ligera opacidad, ítem activo con fondo `--teal` (`#D32F2F`) y borde blanco a la izquierda.
- **Área de Contenido (`#contenido`)**:
  - Margen izquierdo: `250px`, padding: `26px 32px`, fondo `--bg` (`#F4F6F8`).

### B. Paneles y Tarjetas (`.panel`)
- Contenedores con `--panel` (`#ffffff`), borde `--border` (`#e2e8f0`), radio de `12px` y sombra suave (`--sombra-sm`).
- **Racing Stripe**: Pseudo-elemento `.panel::before` de `3px` de alto en color `--racing-stripe` (`#D32F2F`) en el borde superior.

### C. Modales (`.modal-fondo`, `.modal`)
- Overlay fijo con fondo `rgba(33, 30, 30, 0.6)` y desenfoque sutil (`backdrop-filter: blur(2px)`).
- Animación de entrada: `@keyframes modalScaleIn` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Variantes de Tamaño**:
  - `.modal-sm` (`420px`)
  - `.modal-md` (`560px`)
  - `.modal-lg` (`740px`)
  - `.modal-xl` (`860px`)
  - `.modal-2xl` (`960px`)
- **Botón Cierre**: `.cerrar` circular posicionado en la esquina superior derecha con `aria-label="Cerrar modal"`.

### D. Botones (`.btn`)
- **Principal (`.btn`)**: Fondo `--teal` (`#D32F2F`), texto blanco, peso `600`, radio `8px`, sombra al hover con elevación `translateY(-1px)`.
- **Secundario (`.btn.secundario`)**: Fondo blanco, borde `--border`, texto `--navy`.
- **Peligro (`.btn.peligro`)**: Fondo blanco, texto `--red` (`#C0392B`), borde `#f5c6c0`.
- **Pequeño (`.btn.pequeno`)**: Padding reducido `5px 12px`, tamaño de fuente `12px`.
- **Estado Bloqueado / Deshabilitado**: Opacidad `0.55`, cursor `not-allowed`, escala gris parcial.

### E. Badges de Estado (`.badge`)
Etiquetas redondeadas (`border-radius: 999px`), fuente `11.5px`, peso `600`:
- `.badge.verde`: Éxito / Autorizada / Pagada (`#e7f6ee`, texto `#16a34a`).
- `.badge.rojo`: Rechazada / Cancelada / Error (`#fdecea`, texto `#C0392B`).
- `.badge.naranja`: Pendiente de autorización / Con saldo (`#fff4e0`, texto `#d98c00`).
- `.badge.azul`: Enviada / Diagnóstico (`#e6f2f4`, texto `#1b6f7a`).
- `.badge.gris`: Borrador / Sin iniciar (`#eef1f4`, texto `#64748b`).
- `.badge.morado`: Paquete / Especial (`#f0e9f7`, texto `#70459e`).

### F. Tablas (`.tabla`)
- Cabecera pegajosa (`thead th`) con fondo `--panel`, texto `--text-mute`, minúsculas con `letter-spacing: 0.4px`.
- Filas con transición suave al pasar el cursor (`background: #f8fafc`).
- Estado vacío estándar (`.vacio-tabla`) en cursiva neutra.
- Envolvente con scroll horizontal (`.v11-tabla-scroll`) para tablas extensas (ej. Herramienta Especial V11).

### G. Bloques Inline e Inputs de Modo (`.bloque-inline`)
- Tarjetas secundarias integradas dentro de modales grandes (ej. Cotización) para alternar entre *Buscar existente* o *Capturar nuevo* mediante un switch toggle sin abrir popups adicionales.

---

## 6. Accesibilidad e Interacciones (a11y)

- **Anillos de Enfoque (`:focus-visible`)**: Todos los controles interactivos muestran un resplandor de contraste alto en tono rojo de marca (`var(--focus-ring)`).
- **Semántica HTML**: Uso de `<header class="encabezado-modulo">`, `<article class="panel">`, `<nav id="nav-lateral" aria-label="Navegación principal">`.
- **Controles de Cierre**: Todos los modales incluyen un atributo explícito `aria-label="Cerrar modal"`.
