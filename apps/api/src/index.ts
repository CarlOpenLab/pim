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

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === "number") return `${text}[${key}]`;
    return text ? `${text}.${String(key)}` : String(key);
  }, "");
}

/**
 * Zod's own message is a JSON dump of every issue, which ends up in a toast unreadable.
 * The UI validates the same rules first, so this is the backstop for the JSON editor.
 */
function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = formatPath(issue.path);
      return path ? `${path}：${issue.message}` : issue.message;
    })
    .join("；");
}

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
  if (!body.success) return context.json({ error: describeIssues(body.error) }, 400);

  try {
    return context.json(
      await adapter.writeSettings(body.data.scope, body.data.projectPath, body.data.settings),
    );
  } catch (error) {
    if (error instanceof z.ZodError) return context.json({ error: describeIssues(error) }, 400);
    throw error;
  }
});

app.get("/api/agents/:id/model-presets", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  return context.json({ presets: (await adapter.modelPresets?.()) ?? [] });
});

/**
 * Vendors ship models and change prices often, so the UI offers a manual refresh instead
 * of forcing every new model into a code change. The adapter decides what it can rebuild
 * from upstream docs; adapters without a source return 400.
 */
app.post("/api/agents/:id/presets/refresh", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!adapter.refreshPresets) return context.json({ error: "该 Agent 不支持从文档刷新预设" }, 400);

  try {
    return context.json({ presets: await adapter.refreshPresets() });
  } catch (error) {
    // Network failures and refactored docs pages are user input problems, not server faults.
    return context.json({ error: error instanceof Error ? error.message : "刷新预设失败" }, 400);
  }
});

app.put("/api/agents/:id/models", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  const body = modelsRequestSchema.safeParse(await context.req.json());
  if (!body.success) return context.json({ error: describeIssues(body.error) }, 400);

  try {
    return context.json(
      await adapter.writeModels(body.data.models as unknown as ModelsConfiguration),
    );
  } catch (error) {
    // Literal secrets and schema violations are user input problems, not server faults.
    if (error instanceof z.ZodError) return context.json({ error: describeIssues(error) }, 400);
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
