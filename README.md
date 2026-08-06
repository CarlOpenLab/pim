# PIM

PIM is a local-first configuration studio for terminal Agent harnesses. The first adapter targets [Pi](https://pi.dev); the adapter boundary is intended to support OMP and other Agent TUIs later.

## Current scope

- Global and project-scoped Pi `settings.json`
- Custom providers and models in `models.json`
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

## Adding an agent

`AgentAdapter` (`apps/api/src/adapters/types.ts`) is the only thing an agent needs. Implement it
next to `pi.ts`, register it in the `adapters` map in `apps/api/src/index.ts`, and declare its
`capabilities` — the UI derives the agent rail and its tabs from `GET /api/agents`, so no frontend
change is required.

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
