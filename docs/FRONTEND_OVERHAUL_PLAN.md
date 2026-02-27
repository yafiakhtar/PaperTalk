# PaperTalk frontend overhaul — minimal academic

## Design direction (locked in)

- **Palette**: Strict monochrome — black/charcoal text, off-white/cream background, no accent color. No ocean/sun/moss in main UI; reserve for minimal states (e.g. focus ring only if needed).
- **Typography**: Academic classic — **serif for headings** (e.g. Lora or Libre Baskerville), **clean sans for body** (keep IBM Plex Sans or switch to a neutral like Inter/Geist). Generous line-height and letter-spacing for readability.
- **Surfaces**: Flat and minimal — white/off-white panels, **thin borders only**, no glass/blur, no heavy shadow. Optional very light box-shadow (e.g. 0 1px 2px rgba(0,0,0,0.04)) for separation.
- **Left column**: Minimal strip — **very narrow** column, small text or icons only; structure so it can expand later when tab content is decided.

---

## Layout (unchanged)

- **Header**: PaperTalk top-left; optional right area. Minimal: text only, thin bottom border.
- **Three columns**:
  1. **Left**: Minimal strip (tabs) — narrow, small labels or icons.
  2. **Center**: PDF when loaded (object URL from uploaded file) or landing (upload + process).
  3. **Right**: Chat with Type / Voice tabs; shared response area.

---

## Implementation notes for “minimal academic”

### Global styles (`globals.css`)

- **Colors**: `--ink` (e.g. `#1a1a1a` or `#0f172a`), `--surface` (e.g. `#fafaf9` or `#f5f5f4`), `--border` (e.g. `#e5e5e5`). Background: single off-white/cream; no gradients.
- **Remove or override**: `.glass`, gradient on `body`, strong shadows. Use `background: var(--surface)` and `border: 1px solid var(--border)` for panels.
- **Fonts**: Add a serif (e.g. Lora or Libre Baskerville) from Google Fonts; set as `font-display` for headings. Body stays sans-serif.

### Tailwind (`tailwind.config.js`)

- **Theme**: `colors` — ink, surface, border (all grayscale). Remove or minimize ocean/sun/moss from main layout.
- **Fonts**: `display` → serif; `body` → current sans.
- **Shadows**: One very subtle utility (e.g. `shadow-subtle`) or rely on borders only.

### Components

- **Header**: Plain “PaperTalk” (serif or sans), `border-b border-[var(--border)]`, no logo graphic unless you add later.
- **Left strip**: Fixed or min width (e.g. 48–64px or ~4rem); vertical or horizontal small labels; active state = thin underline or dot, no fill.
- **Center**: Landing = one line of copy, one file input, one button; all with thin borders and no cards. PDF = iframe or react-pdf with no chrome, light border.
- **Chat**: Flat input and send; response text in body font; citations/follow-ups as simple lists with minimal dividers; no glass cards.
- **Type/Voice tabs**: Text tabs with underline for active; no pills or heavy backgrounds.

### Responsiveness

- Same three-column grid; left strip can collapse to a single icon or hamburger that expands to show labels on small screens.

---

## File changes (recap)

| File | Change |
|------|--------|
| `apps/web/app/layout.tsx` | Header: PaperTalk left, thin border, minimal. |
| `apps/web/app/page.tsx` | Three-column grid; minimal strip; PDF or landing; chat with Type/Voice; flat panels, no glass. |
| `apps/web/styles/globals.css` | Monochrome vars; serif + sans; no gradient; no .glass. |
| `apps/web/tailwind.config.js` | Ink/surface/border; display serif; subtle or no shadow. |
| `apps/web/lib/api.ts` | Add `queryPaperText` for typed chat when backend exists. |

---

## Optional

- Extract `Header`, `LeftStrip`, `PdfOrUpload`, `ChatPanel` into components for clarity.
- Backend: text-query endpoint for Type tab (same response shape as voice).
