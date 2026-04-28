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

## Authentication

The app requires Keycloak authentication on all routes (`onLoad: 'login-required'`). On load, it redirects unauthenticated users to Keycloak and attaches a Bearer token to every destiny-repository API request. You need a Keycloak account in the `destiny` realm to run the app locally.

Copy `.env.example` to `.env`, fill in the `VITE_KEYCLOAK_*` vars pointing at the dev Keycloak (and a client ID you have access to), then `npm run dev`. Navigate to a real route (e.g. `/esea`, not `/`) — you'll be redirected to Keycloak to sign in, and returned to the app with your display name in the header.
