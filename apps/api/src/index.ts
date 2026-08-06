import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { PiAdapter } from "./adapters/pi.js";
import type { AgentAdapter, ModelsConfiguration } from "./adapters/types.js";

const app = new Hono();
const pi = new PiAdapter();
const adapters = new Map<string, AgentAdapter>([[pi.id, pi]]);

function findDefaultProjectPath(): string {
  if (process.env.PIM_PROJECT_ROOT) return resolve(process.env.PIM_PROJECT_ROOT);
  let current = process.cwd();
  while (dirname(current) !== current) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) || existsSync(join(current, ".git")))
      return current;
    current = dirname(current);
  }
  return process.cwd();
}

const defaultProjectPath = findDefaultProjectPath();
const scopeSchema = z.enum(["global", "project"]);
const settingsRequestSchema = z.object({
  scope: scopeSchema,
  projectPath: z.string().min(1),
  settings: z.record(z.string(), z.unknown()),
});
const modelsRequestSchema = z.object({
  models: z.object({ providers: z.record(z.string(), z.unknown()) }).loose(),
});

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
      return "";
    },
  }),
);

app.get("/api/health", (context) =>
  context.json({ status: "ok", projectPath: defaultProjectPath }),
);

app.get("/api/agents", async (context) => {
  const agents = await Promise.all([...adapters.values()].map((adapter) => adapter.inspect()));
  return context.json({ agents });
});

app.get("/api/agents/:id/configuration", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  const scopeResult = scopeSchema.safeParse(context.req.query("scope") || "global");
  if (!scopeResult.success) return context.json({ error: "Invalid configuration scope" }, 400);

  const projectPath = context.req.query("projectPath") || defaultProjectPath;
  return context.json(await adapter.readConfiguration(scopeResult.data, projectPath));
});

app.put("/api/agents/:id/settings", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  const body = settingsRequestSchema.safeParse(await context.req.json());
  if (!body.success)
    return context.json({ error: "Invalid settings", details: body.error.issues }, 400);

  return context.json(
    await adapter.writeSettings(body.data.scope, body.data.projectPath, body.data.settings),
  );
});

app.put("/api/agents/:id/models", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  const body = modelsRequestSchema.safeParse(await context.req.json());
  if (!body.success)
    return context.json({ error: "Invalid model configuration", details: body.error.issues }, 400);

  try {
    return context.json(
      await adapter.writeModels(body.data.models as unknown as ModelsConfiguration),
    );
  } catch (error) {
    // Literal secrets and schema violations are user input problems, not server faults.
    return context.json({ error: error instanceof Error ? error.message : "保存失败" }, 400);
  }
});

app.onError((error, context) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return context.json({ error: message }, 500);
});

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`Pim API listening on http://${info.address}:${info.port}`);
});

export default app;
