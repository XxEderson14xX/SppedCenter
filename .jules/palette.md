# UX & Palette Learnings - SpeedCenter

## Visual Hierarchy & Styling Architecture
- **Vanilla CSS Tokens**: Standardized design tokens in `assets/styles.css` using CSS custom variables (`--sombra-sm`, `--sombra-md`, `--sombra-lg`, `--sombra-hover`, `--focus-ring`, `--radius-md`, `--transition-normal`).
- **Utility Classes over Inline Styles**: Removed inline `style="..."` attributes from `index.html` in favor of semantic utilities (`.mt-3`, `.mt-4`, `.gap-2`, `.flex-between`, `.readonly-bg`, `.alert-banner`, `.modal-xl`).

## Accessibility (a11y)
- **Modal Controls**: Added explicit `aria-label="Cerrar modal"` attributes on close buttons (`.cerrar`) across all modal components.
- **Focus Indicators**: Integrated `:focus-visible` outlines with high-contrast ring glow (`rgba(211, 47, 47, 0.25)`) across input fields, textareas, select dropdowns, navigation links, and buttons.
- **Semantic HTML**: Refactored module headers to `<header class="encabezado-modulo">` and card panels to `<article class="panel">`.
- **Navigation**: Added `aria-label="Navegación principal"` on `<nav id="nav-lateral">` and `aria-hidden="true"` on decorative menu icons (`.nav-icono`).

## Micro-Interactions & Responsiveness
- **Modal Scale & Backdrop Blur**: Modals animate with `@keyframes modalScaleIn` (`cubic-bezier(0.16, 1, 0.3, 1)`) and soft backdrop blur (`backdrop-filter: blur(2px)`).
- **Hover Transitions**: KPI cards, buttons, table rows, and gallery items use subtle transform elevation (`translateY(-1px)`) and shadow transitions (`transition: all 0.2s ease-in-out`).
- **Mobile Fluidity**: Updated media query breakpoints (`@media (max-width: 768px)`) to collapse form grids, adapt sidebar positioning, and ensure horizontal scrollbars are contained within table wrappers (`.v11-tabla-scroll`).
