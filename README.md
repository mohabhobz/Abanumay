# Abanumay Grants System — UI Prototype

Front-end prototype of the grants management system for the Sulaiman Abanumay Charitable Foundation.
Arabic, fully right-to-left, with light and dark themes. All data is mock data shaped like the
live system; there is no backend connection yet.

**Stack:** React 18 · TypeScript 5.6 · Vite 5 · React Router 7 · Phosphor Icons

## Getting started

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint over `src/` |
| `npm run clean` | Remove `dist/` |

## Deployment

`dist/` is a static single-page app. Any static host works (Vercel, Netlify, S3, Nginx) as long as
every route falls back to `index.html`. `base` in `vite.config.ts` is intentionally `'/'`; a relative
base breaks nested routes such as `/projects/20940`.

## Project structure

```
src/
├─ app/                 App shell and routing
│  ├─ App.tsx           Route map
│  ├─ routes.ts         Single source of truth for every URL and the navigation (NAV)
│  └─ layout/           Layout: background, navigation rail, assistant panel
├─ components/          Shared building blocks, not tied to any module
│  ├─ ui/               Design-system primitives (Tag, KV, Steps, Icon, fields…)
│  ├─ shell/            Rail, breadcrumbs, decision bar, notifications, account menu
│  ├─ charts/           Chart components (donut, bars, stage flow, waffle, pareto…)
│  ├─ table/            Data table (sorting, column resize, views)
│  ├─ assistant/        "Ask Abanumay" assistant engine (thinking → typing → evidence)
│  └─ soul/             Brand motifs and illustrated surfaces
├─ features/            One folder per module (home, projects, entities, budget, plans,
│                       agreements, payments, closing, reports, assistant, settings, auth)
├─ data/
│  ├─ repository.ts     The only seam with the data source
│  └─ mock/             Fixtures
├─ types/domain.ts      Domain model
├─ hooks/               Shared hooks
├─ lib/                 Formatting (numbers, money, dates), theme, helpers
└─ styles/index.css     The full design system: tokens in :root, surfaces, motion
```

**Dependency direction:** `features` import from `components`, `data`, `hooks` and `lib`.
`components` never import from `features`.

## Key files

- **`app/routes.ts`** — never hard-code a URL in a component; use `ROUTES.*`
  (e.g. `ROUTES.project('20940')`). Each `NAV` item carries a permission key so the rail can be
  filtered by the user's role once the backend returns permissions.
- **`types/domain.ts`** — every field maps to a field in the live system; controlled vocabularies are
  typed, so a backend shape mismatch shows up at build time.
- **`data/repository.ts`** — every function returns a `Promise` with the same parameters the API will
  take. Connecting the backend means replacing the mock bodies here with HTTP calls and adding
  loading/error states in the screens; no component calls `fetch` directly.

## Design system

- All values come from tokens in `:root` (`--sp-*` spacing, `--fs-*` type, `--r-*` radius,
  `--mo-*` motion, `--ch-*` chart colors). Spacing, type and radius scales are each derived from a
  single base token, so a system-wide change is one line.
- Every interactive control in a row shares one height (`--h-md`, 44px).
- Motion respects `prefers-reduced-motion`.
- People are rendered with `<Person>` from `src/data/people.ts`; photos are picked up automatically
  from `src/assets/people/<slug>.jpg`.

### RTL notes

- `inset-inline-start` is the right edge, `inset-inline-end` the left.
- Numbers and percentages inside Arabic text are isolated (`<Num>`, `pct()`, `isolate()` in
  `lib/format.ts`); dates always go through `<DateText>`.
- Numeric table columns are marked `n: true` so header and cells align together.

## Data and privacy

Personal and financial identifiers in the mock data are fictitious but well-formed. Real data for a
demo can go in `src/data/mock/*.local.ts`, which is git-ignored.
