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

```
src/
├── api/           # Typed fetch client for destiny-repository API
├── components/    # UI components (layout/, etc.)
├── pages/         # Route pages (SearchPage, RecordDetailPage)
├── styles/        # Global CSS (reset, variables)
├── types/         # TypeScript interfaces
└── config.ts      # Environment configuration
```

Stack: Vite + Preact + TypeScript (matches taxonomy-builder).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api` | destiny-repository API base URL |
| `VITE_API_TARGET` | `http://localhost:8080` | Dev server proxy target |
