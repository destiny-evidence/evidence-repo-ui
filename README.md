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

## Authentication

Every community route requires Keycloak authentication, and attaches a Bearer token to each destiny-repository API request. How a community greets an unauthenticated visitor depends on its `selfSignup` feature flag: a self-signup community (HPV, DESTINY) shows a Sign in / Create account landing, backed by a silent `check-sso` so an existing session skips it; the rest redirect straight to Keycloak (`onLoad: 'login-required'`). You need a Keycloak account in the `destiny` realm to run the app locally.

The slug-less root (`/`) is the exception: it belongs to no community, so it renders a signpost to the listed communities without initialising Keycloak at all.

Copy `.env.example` to `.env`, fill in the `VITE_KEYCLOAK_*` vars pointing at the dev Keycloak (and a client ID you have access to), then `npm run dev`. Navigate to a community route (e.g. `/esea`) — you'll be redirected to Keycloak to sign in, and returned to the app with your display name in the header.
