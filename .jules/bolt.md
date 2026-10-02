## 2026-09-09 - Client-side In-memory Filtering for Table Search Inputs

**Learning:** In SPA frontend architecture with Supabase/REST backends, triggering `await sb.from(...).select(...)` network calls inside search input `input` event listeners creates significant performance degradation (~100-500ms latency per keystroke vs < 1ms), risks out-of-order response race conditions, and generates excessive network traffic. Caching table datasets in memory on initial tab load/mutation and performing client-side array filtering on user typing input provides instantaneous (< 1ms) response time.

**Action:** When implementing or refactoring module search or filter inputs, ensure data fetching (`cargar...`) is decoupled from view rendering/filtering (`render...`). Store loaded records in module state arrays (`_listaClientes`, `_listaVehiculos`, `estado.catalogoMaestro`, etc.) and filter in memory on keystrokes.
