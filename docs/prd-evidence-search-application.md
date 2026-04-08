# Epic: Evidence Search Application

## Summary

Build a new public-facing application for evidence synthesisers to search and inspect ESEA-enhanced records in the destiny repository. Static React app, deployed to blob storage with Azure Front Door. Auth via Keycloak — needed for abstract visibility. Blocked on destiny-repository switching to Keycloak in production; abstracts may be omitted until then. Hard-coded for ESEA first.

The app consumes the existing destiny-repository API for references/search and fetches vocabulary artifacts directly from blob storage for client-side label resolution (available as compact JSON-LD, TTL, and other formats). No BFF initially — introduce one later if client-side parsing proves insufficient.

**Repo:** [destiny-evidence/evidence-repo-ui](https://github.com/destiny-evidence/evidence-repo-ui)

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Static React App (Vite + TypeScript)            │
│  Deployed: blob storage + Azure Front Door       │
│  Auth: Keycloak (blocked on API switchover)       │
├──────────────────────────────────────────────────┤
│  Consumes:                                       │
│  1. destiny-repository API (search, references)  │
│  2. vocabulary_uri → vocabulary artifact          │
│  3. context_uri → JSON-LD context (immutable)    │
└──────────────────────────────────────────────────┘
```

## EV Core class hierarchy (reference for card design)

```
Investigation
  ├─ documentType, funderResearch, isRetracted, dataSource
  └─ hasFinding → Finding[] (1+)
       ├─ evaluates → Intervention
       │   ├─ educationTheme[], implementerType, implementationDescription[]
       │   ├─ implementationFidelity, implementationName, duration
       │   └─ funderIntervention
       ├─ comparedTo → ControlCondition
       ├─ hasContext → Context (1+)
       │   ├─ educationLevel[], setting[], country, countryLevel1
       │   └─ participants[]
       ├─ hasOutcome → Outcome (1+)
       │   └─ outcome[] (CodingAnnotation)
       ├─ sampleSize, attrition, cost, groupDifferences, sampleFeatures[]
       ├─ hasArmData → ObservedResult[] (1+)
       │   ├─ forCondition → Condition (blank node ref)
       │   └─ n, mean, sd, se, preMean, preSd, clusterCount, icc, events
       └─ hasEffectEstimate → EffectEstimate[] (1+)
            ├─ pointEstimate, standardError, variance, CI lower/upper
            ├─ effectSizeMetric, estimateSource (evrepo-core concepts)
            └─ baselineAdjusted, clusteringAdjusted, derivedFrom, forOutcome
```

---

## Tasks

### evidence-repo-ui#1 — Project scaffold and infrastructure

**Repo:** evidence-repo-ui

Scaffold the application:
- Suggested stack: Vite + React + TypeScript (final choices left to implementer)
- Client-side routing
- HTTP client for API calls
- Basic layout shell (header, main content area)
- Environment config for destiny-repository API base URL and Keycloak
- Auth integration via Keycloak (blocked on destiny-repository production switchover; abstracts omitted until then)
- Three route stubs: `/:community` (search, e.g. `/esea`), `/:community/references/:id` (record detail)
- Investigate rdflib.js for vocabulary/data parsing — may be needed for robust handling of compact JSON-LD and TTL formats

---

### evidence-repo-ui#2 — API client for destiny-repository

**Repo:** evidence-repo-ui

Create `src/services/apiClient.ts`:
- `searchReferences(query, filters)` → calls `GET /v1/search/` with configurable base URL
- `getReference(id)` → calls `GET /v1/references/?identifier={id}`
- Helper to extract `LinkedDataEnhancement` and `BibliographicMetadataEnhancement` from the enhancements array (use most recent if multiple)
- TypeScript types for API response shapes (Reference, Enhancement, SearchResult, pagination)

Note: search results return the full `Reference` objects with all enhancements, so the detail page could use client-side state from search results when available, falling back to `getReference(id)` for deep links.

---

### evidence-repo-ui#3 — Vocabulary service (client-side label resolution)

**Repo:** evidence-repo-ui

Create a vocabulary service for client-side label resolution.

**Vocabulary fetching + caching:**
- Fetch vocabulary from `vocabulary_uri` (HTTP GET, immutable URL — cache indefinitely)
- The published vocabulary is available in multiple formats: compact JSON-LD (`vocabulary.jsonld` with `@context` + `@graph`), TTL (`vocabulary.ttl`), plain JSON (`vocabulary.json`), RDF/XML (`vocabulary.rdf`)
- Build `Map<conceptUri, prefLabel>` from SKOS Concept entries
- Approach options: parse compact JSON-LD directly, or use rdflib.js with TTL. Try the simplest approach first (JSON-LD compact is parseable as plain JSON); fall back to rdflib.js if needed.
- evrepo-core concepts (effect size metrics, estimate sources) are imported into the ESEA vocabulary, so no separate static mapping is needed

**Context fetching + URI expansion:**
- Fetch `@context` JSON from the context URI in the linked data (`context.jsonld`)
- Cache by URL
- Implement `expandUri(compactUri)` using prefix mappings from the context (e.g. `esea:C00008` → `https://vocab.esea.education/C00008`)

**Reference:** Published artifacts at `taxonomy-builder/backend/.blob-storage/019d2cfa-.../1.0/` (vocabulary.jsonld, vocabulary.ttl, context.jsonld). ESEA context is at `destiny-repository/app/static/vocab/esea/esea-context.jsonld`.

---

### evidence-repo-ui#4 — Investigation data parser

**Repo:** evidence-repo-ui

Create `src/services/investigationParser.ts`:

Walks the `LinkedDataEnhancement.data` JSON-LD dict and produces typed structures using the vocabulary service for label resolution.

**Input:** raw `data` dict from LinkedDataEnhancement + vocabulary service (using the enhancement's own `vocabulary_uri` — different enhancements may reference different vocabulary versions)
**Output:** `InvestigationData` with typed `FindingData[]`, each containing `InterventionData`, `ContextData`, `OutcomeData`, `EffectEstimateData[]`, `ArmData[]`

The graph structure is defined by the SHACL shapes (`evrepo-core-shapes.ttl`) and the `@context`. The parser should walk according to those. Implementation notes for non-obvious aspects:
- Compact URIs (e.g. `esea:C00008`) need expanding via the `@context` before vocabulary lookup
- `NumericCodingAnnotation` uses typed JSON-LD values (`{"@type": "xsd:integer", "@value": 47}`), not bare numbers
- Status values are compact URIs too (`"evrepo:coded"`, `"evrepo:notReported"`)
- Blank node IDs (`"_:intervention"`, `"_:control"`) cross-reference arms to conditions — collect on first pass, resolve on second
- Skip annotations with status `notReported` or `notApplicable`

**Reference data:**
- Robot output examples: `vocabulary-mapping-robot/vocab/0e8f0ddd-d0ab-460c-ac66-2683a11f3ef7.jsonld`, `vocabulary-mapping-robot/vocab/7d6f1092-1976-4903-ab17-330b79787f7d.jsonld`, `vocabulary-mapping-robot/vocab/b7a34d6d-f11e-4852-9030-d060a6bfdf8f.jsonld`
- SHACL shapes: `destiny-repository/app/static/evrepo-core-shapes.ttl`

---

### evidence-repo-ui#5 — Search page and results list

**Repo:** evidence-repo-ui

Implement the search page at `/:community`. Only `/esea` will be supported initially — hard-coded as the single community for now.

**Search:**
- Search box with query input
- Scoped to the community in the URL path — filters to that community's enhanced records (see open questions re scoping filter)
- Concept filtering via Lucene query syntax against projected fields; dedicated filter parameters deferred

**Results list:**
- Terse list: title, authors, year, DOI link, abstract snippet
- Pagination
- Possible richness indicators (finding count, whether effect estimates are present) — TBD, take a rough shot and iterate
- Click result → navigate to `/:community/references/:id`

---

### evidence-repo-ui#6 — Record detail page: Investigation card

**Repo:** evidence-repo-ui

Implement the top-level investigation card on `/:community/references/:id`:

- Fetch reference, vocabulary, context (with caching)
- Parse linked data via investigation parser

**Investigation card renders:**
- Title, authors (formatted citation), publication venue, volume/issue/pages
- Publication year
- Tags row: documentType label, education level labels as concept pills
- Sample size, analysis sample from finding-level data
- Funder section: funderResearch, funderIntervention
- isRetracted flag (prominent warning if true)

**Concept tags** show property label + concept label (e.g. "education level: Lower Primary"), linkable to taxonomy definition URLs.

---

### evidence-repo-ui#7 — Record detail page: Finding cards

**Repo:** evidence-repo-ui

Render one card per finding within the record detail page. Card layout and grouping of fields is left to the implementer — the screenshot and the EV Core class hierarchy provide design direction, but the final presentation should emerge from working with the data.

Available data per finding (from SHACL shapes):
- Intervention: name, education themes, implementer type, implementation description, fidelity, duration, funder
- Context: education levels, settings, country, country level 1, participants
- Outcome: outcome concept labels with supporting text
- Sample features, sample size, attrition, cost, group differences
- Supporting text on coding annotations

Concepts should display with their property label (e.g. "education level: Lower Primary") and be linkable to taxonomy definitions.

Multi-arm studies are particularly important to render well — clearly show which arms are being compared.

---

### evidence-repo-ui#8 — Record detail page: Effect estimate and arm data cards

**Repo:** evidence-repo-ui

Render effect estimates and arm data within each finding card. Layout left to implementer — the screenshot and EV Core class hierarchy provide design direction.

Available data per effect estimate (from SHACL shapes):
- pointEstimate, standardError, variance, confidenceLevel, CI lower/upper
- effectSizeMetric (concept label, e.g. "Hedges' g", "Cohen's d")
- estimateSource (concept label, e.g. "Computed from summary statistics")
- baselineAdjusted, clusteringAdjusted
- derivedFrom → ObservedResult, forOutcome → Outcome

Available data per arm (ObservedResult):
- forCondition → Condition (intervention or control, via blank node ref)
- n, mean, sd, se, preMean, preSd, clusterCount, icc, events

---

### evidence-repo-ui#9 — Deployment pipeline

**Repo:** evidence-repo-ui

- GitHub Actions workflow: build static site on push to main
- Deploy to Azure Blob Storage (static website hosting)
- Azure Front Door configuration
- Environment-specific API base URL configuration

---

### taxonomy-builder#TBD — Publish evrepo-core-shapes alongside vocabulary artifacts

**Repo:** taxonomy-builder

Include `evrepo-core-shapes.ttl` in the blob storage publication alongside the existing vocabulary artifacts (vocabulary.jsonld, vocabulary.ttl, context.jsonld). This makes the SHACL shapes accessible at a stable URL, avoiding duplication across consumers (destiny-repository, evidence-repo-ui, etc.). destiny-repository's bundled copy at `app/static/evrepo-core-shapes.ttl` can then be replaced with a fetch from the published URL.

---

### destiny-repository#TBD — CORS configuration for evidence-repo-ui

**Repo:** destiny-repository

Ensure the destiny-repository API allows cross-origin requests from the evidence-repo-ui domain. May need CORS headers added to FastAPI middleware if not already configured for external frontends.

---

### destiny-repository#590 — (existing) Linked data projection and search

**Repo:** destiny-repository
**Note:** Already tracked. PR #596 adds three new searchable ES fields: `linked_data_concepts` (Keyword), `linked_data_labels` (Text), `linked_data_evaluated_properties` (Keyword). Queryable via Lucene syntax only — no dedicated search parameters yet. The evidence-repo-ui search can use Lucene queries against these fields (e.g. `linked_data_concepts:"https://vocab.esea.education/C00074"` or `linked_data_labels:literacy`).

---

## Key reference files in destiny-evidence

| File | Purpose |
|------|---------|
| `destiny-repository/app/static/vocab/esea/esea-context.jsonld` | Context for compact URI expansion |
| `vocabulary-mapping-robot/vocab/0e8f0ddd-*.jsonld` (+ 7d6f1092, b7a34d6d) | Robot output examples |
| `taxonomy-builder/backend/.blob-storage/019d2cfa-.../1.0/` | Published vocabulary artifacts (jsonld, ttl, context) |
| `destiny-repository/app/static/evrepo-core-shapes.ttl` | SHACL shapes — required relationships |
| `destiny-repository/libs/sdk/src/destiny_sdk/enhancements.py` | LinkedDataEnhancement SDK model |
| `destiny-repository/app/domain/references/routes.py` | Existing API endpoints |

## Notes

- **ESEA scoping filter**: Jacobs/ESEA references have a `domain-inclusion/jacobs-education` boolean annotation (applied via vocabulary-mapping-robot PR #4, destiny-repository#588). This is queryable via Lucene (`annotations:domain-inclusion/jacobs-education`) or via the `?annotation=` search parameter, and is the scoping mechanism for the `/esea` community view.
