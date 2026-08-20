# PIM

PIM is a local-first configuration studio for terminal Agent harnesses. The first adapter targets [Pi](https://pi.dev); the adapter boundary is intended to support OMP and other Agent TUIs later.

## Current scope

- Global and project-scoped Pi `settings.json`
- Custom providers and models in `models.json`, including per-model context window, output cap,
  API shape, capabilities, per-million-token pricing, and provider-specific `compat` switches
- Provider templates so a new provider or model starts from a working baseline
- Credential status from `auth.json` without returning secret values
- Extensions, skills, prompt templates, themes, and package paths
- Structured forms plus an advanced JSON editor
- JSONC reads, schema validation, atomic writes, and timestamped backups

## Secrets

PIM configures models — it never handles keys. Configuration files only hold a `$VAR_NAME`
reference; the agent reads that variable from its own environment when it authenticates, so the
plaintext only ever lives in the agent process.

- The forms only produce references, and `apps/api/src/secret-ref.ts` rejects literal `apiKey`,
  `oauth`, and header values on write — including anything typed into the advanced JSON editor.
- Literal values already present on disk are sent to the browser as `__PIM_REDACTED__`, restored
  on save by the API, and flagged in the UI with a one-click switch to a reference.
- `secretRefs` in the configuration payload reports which variables a configuration needs and
  whether they exist in the PIM process environment — a boolean, never a value.

PIM binds its API to `127.0.0.1`.

## Model presets

`apps/api/src/presets/pi.ts` holds the provider templates served by
`GET /api/agents/:id/model-presets`. They are a starting point, not a source of truth: the
connection fields are the durable part, while model IDs and prices move whenever a vendor ships,
so the UI tells the user to verify whatever it imported. A preset never carries a key value — only
a `$VAR_NAME` reference, which `apps/api/tests/model-presets.test.ts` asserts along with the write
schema.

Editing happens in two places. The model table covers the fields worth scanning across a catalog;
the per-model drawer covers everything else, with `compat` left as a JSON field because its keys
are provider-specific. `apps/website/src/model-validation.ts` runs the same rules the API enforces
on write, so an incomplete row is pointed at in place instead of coming back as a schema error.

Presets can also be rebuilt from upstream docs without a code change. The model catalog card has a
「刷新预设」button (`POST /api/agents/:id/presets/refresh`, backed by
`apps/api/src/presets/opencode-go.ts`); it re-reads the OpenCode Go docs, re-parses the model IDs,
endpoints and per-million-token prices, and caches the result in the agent config directory so the
fresh catalog survives restarts. Adapters that do not opt into `refreshPresets()` simply hide the
button.

## Adding an agent

`AgentAdapter` (`apps/api/src/adapters/types.ts`) is the only thing an agent needs. Implement it
next to `pi.ts`, register it in the `adapters` map in `apps/api/src/index.ts`, and declare its
`capabilities` — the UI derives the agent rail and its tabs from `GET /api/agents`, so no frontend
change is required. `modelPresets` is optional; an adapter that omits it just gets a manual-only
add flow.

## Development

Install dependencies and start both services:

```bash
vp install
vp run dev
```

- Web UI: http://localhost:5173
- Local API: http://127.0.0.1:8787

The website proxies `/api` requests to the local API in development.

## Validation

```bash
vp run ready
```

This runs formatting, linting, type checking, tests, and all workspace builds.

## Project layout

- `apps/website`: Vue 3 + Antdv Next configuration interface
- `apps/api`: Hono local API and Agent adapters
- `apps/api/src/adapters/pi.ts`: Pi-specific paths, schemas, secret handling, and persistence
- `packages/utils`: starter shared package, available for extracting cross-adapter utilities
