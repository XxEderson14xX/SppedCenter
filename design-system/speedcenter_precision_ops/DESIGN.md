---
name: SpeedCenter Precision Ops
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#5b403d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#8f6f6c'
  outline-variant: '#e4beba'
  surface-tint: '#ba1a20'
  primary: '#af101a'
  on-primary: '#ffffff'
  primary-container: '#d32f2f'
  on-primary-container: '#fff2f0'
  inverse-primary: '#ffb3ac'
  secondary: '#625d5d'
  on-secondary: '#ffffff'
  secondary-container: '#e5dedd'
  on-secondary-container: '#666161'
  tertiary: '#00616c'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b7a85'
  on-tertiary-container: '#defaff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#930010'
  secondary-fixed: '#e8e1e0'
  secondary-fixed-dim: '#ccc5c4'
  on-secondary-fixed: '#1e1b1b'
  on-secondary-fixed-variant: '#4a4646'
  tertiary-fixed: '#a4eefb'
  tertiary-fixed-dim: '#88d2de'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  brand-hover: '#B71C1C'
  surface-sidebar: '#211E1E'
  surface-sidebar-hover: '#2B2727'
  surface-canvas: '#F4F6F8'
  surface-card: '#FFFFFF'
  border-subtle: '#E2E8F0'
  text-main: '#1E2833'
  text-muted: '#64748B'
  status-success-text: '#16A34A'
  status-success-bg: '#E7F6EE'
  status-danger-text: '#C0392B'
  status-danger-bg: '#FDECEA'
  status-warning-text: '#D98C00'
  status-warning-bg: '#FFF4E0'
  status-info-text: '#1B6F7A'
  status-info-bg: '#E6F2F4'
  status-draft-text: '#64748B'
  status-draft-bg: '#EEF1F4'
  status-special-text: '#70459E'
  status-special-bg: '#F0E9F7'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  badge:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: '600'
    lineHeight: 14px
  metric-bold:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
  code-vin:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  code-folio:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-efficiency automotive workshop administration interface built for intensive 8-hour operational shifts. The visual language balances industrial engineering precision with corporate enterprise ergonomics.

### Persona & Context
Users are service advisors, master technicians, workshop managers, and inventory custodians operating under time pressure. The UI prioritizes zero visual friction, rapid scannability, unambiguous status distinctions, and immediate tactile clarity.

### Visual Style
- **Corporate Precision & Automotive Functionalism**: Crisp structure anchored by dense data cards, subtle layered elevation, and a distinct 3px brand racing stripe (`#D32F2F`) across the top perimeter of primary panels.
- **Ergonomic Palette Architecture**: Heavy neutral fog surfaces (`#F4F6F8`) reduce glare and optical fatigue, while high-contrast dark slate (`#211E1E`) delivers a sturdy frame for sidebar workflows.
- **Strict Distinction Between Brand & Alert**: The brand red (`#D32F2F`) represents forward action, active selection, and primary progression; the danger red (`#C0392B`) is reserved strictly for system destruction, rejected work orders, and critical alerts.

## Colors

The color palette is engineered specifically for operational safety and rapid visual scanning across diagnostic pipelines.

### Hierarchy & Application
- **Primary Brand Red (`#D32F2F`)**: Powers core calls-to-action, primary flow buttons, active tab indicators, and the hallmark 3px top racing stripe on operational panels.
- **Primary Brand Hover (`#B71C1C`)**: Deep, controlled red for mouse hover states on primary interactive elements.
- **Warm Navy Charcoal (`#211E1E`)**: Provides structural framing across the 250px persistent sidebar navigation, modal backdrops, and core section titles.
- **Fog Neutral Surface (`#F4F6F8`)**: Foundation canvas tint engineered to minimize optical strain over extended work hours.
- **Card Panel White (`#FFFFFF`)**: Pure background for modular cards, data tables, and input containers.

### Functional Status Indicators (Badges & Alerts)
Semantic badge combinations use matched low-saturation pastel tints with high-contrast text to exceed WCAG 2.1 AA accessibility:
- **Green (Success / Authorized / Paid)**: `#16A34A` over `#E7F6EE`
- **Red (Alert / Danger / Cancelled)**: `#C0392B` over `#FDECEA` (distinguished from the `#D32F2F` brand color)
- **Amber (Pending Authorization / Balance Due)**: `#D98C00` over `#FFF4E0`
- **Teal Blue (Sent / Diagnosis / Info)**: `#1B6F7A` over `#E6F2F4`
- **Slate Gray (Draft / Not Started)**: `#64748B` over `#EEF1F4`
- **Purple (Service Package / Special Custody)**: `#70459E` over `#F0E9F7`

## Typography

The typography structure is built for rapid recognition of mechanical identifiers, operational totals, and workflow states.

### Type Pairings
- **Primary Typeface (`Inter`)**: Deployed across all interface prose, tables, headers, and form fields. It provides neutral, unadorned structural legibility even at dense 12px scales.
- **Monospace Tabular Data (`JetBrains Mono`)**: Strict requirement for operational identifiers including 17-character VIN/NIV sequences, quote folios (`COT-YYYY-XXXXXX`), tool inventory tags (`HER-XXXXXXXXXXXX`), vehicle license plates, and monetary columns in Mexican Pesos ($ MXN). This guarantees consistent vertical column alignment.

### Numeric & Currency Styling
All currency figures and metrics employ tabular lining figures (`font-variant-numeric: tabular-nums;`) with a 700 weight for primary balances, subtotals, and deposit requirements.

## Layout & Spacing

This design system uses a persistent fixed-sidebar and responsive content canvas architecture.

### Canvas & Shell Rules
- **Sidebar Canvas**: Fixed at a rigid width of `250px`, pinned to the left viewport edge with zero scroll on the outer frame.
- **Main Operating Canvas**: Occupies the remainder of the viewport (`calc(100vw - 250px)`), with an internal padding rhythm of `26px 32px` (`1.625rem 2rem`).
- **Data Card Grid**: Employs a 12-column fluid grid inside the operational canvas, collapsing to single-column blocks below `768px`.

### Density Adaptations
- **Desktop (>1024px)**: High-density layout with 12-column multi-panel layouts, horizontal data tables with sticky headers, and split-screen modal editors.
- **Tablet (768px - 1024px)**: Sidebar collapses into an off-canvas drawer or slim icon strip (64px). Metrics panel tiles wrap into 2x2 grids.
- **Mobile (<768px)**: Canvas margins drop to `1rem`, tables trigger dedicated horizontal drag-scroll wrappers (`.v11-tabla-scroll`), and modal widths expand to `calc(100vw - 1.5rem)`.

## Elevation & Depth

Visual hierarchy uses crisp boundaries combined with low-deflection ambient shadow tiers. This prevents blur artifacts on workshop screens.

### Elevation Hierarchy
- **Level 0 (Flat / Canvas)**: Background `#F4F6F8` with no shadow.
- **Level 1 (Card & Panel Standard)**: `#FFFFFF` card surface wrapped with a 1px border of `#E2E8F0` and `0 1px 2px 0 rgba(0, 0, 0, 0.05)`.
- **Level 2 (Active Card Hover / Dropdown Menu)**: `0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.06)`, translated `translateY(-1px)`.
- **Level 3 (Modals & Overlays)**: `0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.10)`.

### Racing Stripe & Focus Geometry
- **Racing Stripe Accent**: Primary panels display an absolute or pseudo-element line on the top edge (`height: 3px; background-color: #D32F2F; border-radius: 12px 12px 0 0;`).
- **Focus Rings**: Pure accessibility compliance via `:focus-visible` with `outline: none; box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.25);`.

## Shapes

The interface balances sharp industrial utility with ergonomic modern card radii:
- **Panels & Containers**: `12px` (`0.75rem`), balancing friendly geometry with dense content containment.
- **Buttons, Inputs & Form Fields**: `8px` (`0.5rem`) for crisp actionable visual affordance.
- **Badges & Status Pills**: Full pill geometry (`border-radius: 9999px`) to immediately distinguish workflow metadata from interactive buttons.
- **Small Controls & Checkboxes**: `4px` - `6px` for compact precision inside checklist items and line-item row selection.

## Components

### Buttons
- **Primary Button**: Solid `#D32F2F` background, `#FFFFFF` text, `font-weight: 600`, `font-size: 14px`, `border-radius: 8px`, `padding: 9px 18px`. Hover shifts to `#B71C1C` with `transform: translateY(-1px)` and subtle shadow.
- **Secondary Button**: `#FFFFFF` background, `1px solid #E2E8F0` border, `#211E1E` text. Hover shifts to `#F8FAFC`.
- **Danger Button**: `#FFFFFF` background, `1px solid #F5C6C0` border, `#C0392B` text. Hover background `#FDECEA`.
- **Compact Button (`.btn-sm`)**: Reduced padding `5px 12px`, `font-size: 12px`.

### Badges & Status Pills
- Formatted as inline-flex elements with `border-radius: 9999px`, `font-size: 11.5px`, `font-weight: 600`, and `padding: 3px 10px`.
- Pairings strictly enforce the predefined semantic colors (e.g. Authorized: `#E7F6EE` background with `#16A34A` text).

### Form Inputs & Mode Switches
- Input containers feature `#FFFFFF` background, `1px solid #E2E8F0` borders, `padding: 8px 12px`, `font-size: 14px`, and `border-radius: 8px`.
- Focus triggers `border-color: #D32F2F` with `box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.25)`.
- **Inline Modal Switcher (`.bloque-inline`)**: Segmented pill control inside creation panels allowing instant toggling between "Search Existing" and "Create New" without modal jumping.

### Operational Panels
- White container (`#FFFFFF`) with 12px radius, light border (`#E2E8F0`), and the signature 3px `#D32F2F` top racing stripe.
- Header holds a 16px–18px bold title, auxiliary subtitle in `#64748B`, and contextual action buttons on the right.

### High-Density Data Tables
- Sticky `thead` styled in `#FFFFFF` with uppercase `#64748B` labels, `font-size: 12px`, `font-weight: 600`, and letter spacing of `0.04em`.
- Row transitions: smooth background shift to `#F8FAFC` on hover.
- Dedicated monospace styling for VIN, quote codes, and tool serials.

### Special Modals
- Backdrop tinted with `rgba(33, 30, 30, 0.6)` and `backdrop-filter: blur(2px)`.
- Modal surface uses `border-radius: 12px`, explicit circular close control in the top-right corner with `aria-label="Cerrar modal"`, and a standardized scale of five widths:
  - Small: `420px` (confirmation alerts)
  - Medium: `560px` (quick forms)
  - Large: `740px` (order details)
  - Extra-Large: `860px` (quote builders)
  - 2XL: `960px` (full diagnostic worksheets)