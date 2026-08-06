# PIM

PIM is a local-first configuration studio for terminal Agent harnesses. The first adapter targets [Pi](https://pi.dev); the adapter boundary is intended to support OMP and other Agent TUIs later.

## Current scope

- Global and project-scoped Pi `settings.json`
- Custom providers and models in `models.json`
- Credential status from `auth.json` without returning secret values
- Extensions, skills, prompt templates, themes, and package paths
- Structured forms plus an advanced JSON editor
- JSONC reads, schema validation, atomic writes, and timestamped backups

PIM binds its API to `127.0.0.1`. It does not expose credential plaintext to the browser. Literal keys and headers from `models.json` are represented by `__PIM_REDACTED__` and restored by the API when the configuration is saved.

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
