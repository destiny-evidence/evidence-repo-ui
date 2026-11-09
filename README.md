# evidence-repo-ui

Public-facing Preact SPA for searching and inspecting ESEA-enhanced records in the destiny repository.

## Development

```bash
npm install
npm run dev        # dev server on port 3000
npm test           # run tests
npm run typecheck  # type check
npm run build      # production build → dist/
```

## Architecture

```text
src/
├── api/           # Typed fetch client for destiny-repository API
├── components/    # UI components (layout/, etc.)
├── pages/         # Route pages (SearchPage, RecordDetailPage)
├── styles/        # Global CSS (reset, variables)
├── types/         # TypeScript interfaces
└── config.ts      # Environment configuration
```

Stack: Vite + Preact + TypeScript

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE` | `/api` | destiny-repository API base URL |
| `VITE_API_TARGET` | `http://localhost:8000` | Dev server proxy target for `/api` |
| `VITE_KEYCLOAK_URL` | _(required)_ | Keycloak base URL, e.g. `https://auth.evidence-repository.org` |
| `VITE_KEYCLOAK_REALM` | _(required)_ | Keycloak realm, e.g. `destiny` |
| `VITE_KEYCLOAK_CLIENT_ID` | _(required)_ | Keycloak public client ID, e.g. `evidence-repo-ui-client-development` |
| `VITE_MATOMO_URL` | unset | Matomo base URL, e.g. `https://futureevidence.matomo.cloud/` |
| `VITE_MATOMO_SITE_ID` | unset | Site id of the matomo measurable to send tracking to e.g. `5` for the dev measurable |

## Data sources

### Country shapes

`src/data/world-geo.json` (the geographic heat map's TopoJSON) is generated from [Natural Earth](https://www.naturalearthdata.com/) by `scripts/generate-world-geo.mjs`:

```bash
npm run generate:geo
```

- **Source:** Natural Earth `v5.1.2`, 1:50m Admin 0 – Countries and Admin 0 – Tiny Countries, from the [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson) repository. The script downloads them from the tag's commit (`f1890d9`), so the files can't change under it.
- **Licence:** public domain ([Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/)).
- **Changes:** countries are keyed by `ISO_A2_EH` (so France, Norway and Kosovo resolve), Natural Earth features sharing a code are merged, shapes without an ISO code (Somaliland, Northern Cyprus, Siachen Glacier) are kept unkeyed, Antarctica is dropped, and the shapes are simplified and quantized. Countries too small to see at world scale get a dot, placed from the Tiny Countries layer; the map only draws a country's dot when it has references.
- Boundaries follow Natural Earth's default (de facto) point of view.

## Authentication

The app requires Keycloak authentication on all community routes (`onLoad: 'login-required'`). On load, it redirects unauthenticated users to Keycloak and attaches a Bearer token to every destiny-repository API request. You need a Keycloak account in the `destiny` realm to run the app locally.

Copy `.env.example` to `.env`, fill in the `VITE_KEYCLOAK_*` vars pointing at the dev Keycloak (and a client ID you have access to), then `npm run dev`. Navigate to a community route (e.g. `/esea`) — you'll be redirected to Keycloak to sign in, and returned to the app with your display name in the header.
