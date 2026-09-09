import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { OmpAdapter } from "./adapters/omp.js";
import { PiAdapter } from "./adapters/pi.js";
import type { AgentAdapter, ModelsConfiguration } from "./adapters/types.js";
import { createPresetRegistry } from "./presets/registry.js";

const app = new Hono();
const pi = new PiAdapter();
const omp = new OmpAdapter();
const adapters = new Map<string, AgentAdapter>([
  [pi.id, pi],
  [omp.id, omp],
]);
// Model presets live in their own layer: each agent declares a preset source (built-ins,
// refresh source, cache dir), and the routes below only ever talk to this registry.
const presetRegistry = createPresetRegistry({
  piConfigDir: pi.configDir,
  ompConfigDir: omp.configDir,
});

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

  return context.json({ presets: await presetRegistry.modelPresetsFor(adapter.id) });
});

/**
 * Vendors ship models and change prices often, so the UI offers a manual refresh instead
 * of forcing every new model into a code change. The preset source decides what it can
 * rebuild from upstream docs; sources without one reject with the same 400.
 */
app.post("/api/agents/:id/presets/refresh", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);

  try {
    return context.json({ presets: await presetRegistry.refreshPresetsFor(adapter.id) });
  } catch (error) {
    // Network failures, refactored docs pages, and unsupported sources are user input
    // problems, not server faults.
    return context.json({ error: error instanceof Error ? error.message : "刷新预设失败" }, 400);
  }
});

app.get("/api/agents/:id/role-presets", (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  return context.json({ presets: adapter.getRolePresets?.() ?? [] });
});

app.get("/api/agents/:id/available-models", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!adapter.getAvailableModels) return context.json({ models: [] });
  return context.json({ models: await adapter.getAvailableModels() });
});

app.get("/api/agents/:id/model-roles", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!adapter.getModelRoles) return context.json({ roles: {} });
  return context.json({ roles: await adapter.getModelRoles() });
});

app.put("/api/agents/:id/model-roles", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!adapter.setModelRoles) return context.json({ error: "该 Agent 不支持 modelRoles" }, 400);
  const body = await context.req.json().catch(() => ({}));
  const roles = (body as any).roles ?? (body as any).modelRoles ?? body;
  if (!roles || typeof roles !== "object" || Array.isArray(roles))
    return context.json({ error: 'roles 需为对象：{ role: "provider/model:thinking" }' }, 400);
  try {
    const saved = await adapter.setModelRoles(roles);
    return context.json({ roles: saved });
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : "保存 modelRoles 失败" },
      400,
    );
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

/**
 * Checks whether a provider has credentials configured.
 * For OMP: uses `omp token <provider>`.
 * For Pi: uses `pi auth check --provider <provider>`.
 */
app.get("/api/agents/:id/auth-broker/check", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!("checkCredential" in adapter)) {
    return context.json({ error: "该 Agent 不支持凭据检查" }, 400);
  }
  const providerId = context.req.query("providerId");
  if (!providerId || typeof providerId !== "string") {
    return context.json({ error: "需要指定 providerId" }, 400);
  }
  try {
    const result = await (adapter as OmpAdapter | PiAdapter).checkCredential(providerId);
    return context.json(result);
  } catch (error) {
    return context.json({ error: error instanceof Error ? error.message : "检查凭据失败" }, 500);
  }
});

/**
 * Removes a provider's credentials.
 * For OMP: runs `omp auth-broker logout <provider>`.
 * For Pi: removes from auth.json.
 */
app.post("/api/agents/:id/auth-broker/logout", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!("logoutProvider" in adapter)) {
    return context.json({ error: "该 Agent 不支持退出登录" }, 400);
  }
  const body = (await context.req.json().catch(() => ({}))) as { providerId?: string };
  if (!body.providerId || typeof body.providerId !== "string") {
    return context.json({ error: "需要指定 providerId" }, 400);
  }
  try {
    const result = await (adapter as OmpAdapter | PiAdapter).logoutProvider(body.providerId);
    if (result.success) {
      return context.json(result);
    }
    return context.json({ ...result, error: result.message }, 400);
  } catch (error) {
    return context.json(
      { success: false, error: error instanceof Error ? error.message : "退出登录失败" },
      500,
    );
  }
});

/**
 * Sets an API Key for a provider.
 * For OMP: stores in agent.db.
 * For Pi: stores in auth.json.
 */
app.post("/api/agents/:id/auth-broker/set-key", async (context) => {
  const adapter = adapters.get(context.req.param("id"));
  if (!adapter) return context.json({ error: "Unsupported agent" }, 404);
  if (!("setApiKey" in adapter)) {
    return context.json({ error: "该 Agent 不支持设置 API Key" }, 400);
  }
  const body = (await context.req.json().catch(() => ({}))) as {
    providerId?: string;
    apiKey?: string;
  };
  if (!body.providerId || typeof body.providerId !== "string") {
    return context.json({ error: "需要指定 providerId" }, 400);
  }
  if (!body.apiKey || typeof body.apiKey !== "string") {
    return context.json({ error: "需要指定 apiKey" }, 400);
  }
  try {
    const result = await (adapter as OmpAdapter | PiAdapter).setApiKey(
      body.providerId,
      body.apiKey,
    );
    if (result.success) {
      return context.json(result);
    }
    return context.json({ ...result, error: result.message }, 400);
  } catch (error) {
    return context.json(
      { success: false, error: error instanceof Error ? error.message : "设置 API Key 失败" },
      500,
    );
  }
});

app.onError((error, context) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return context.json({ error: message }, 500);
});

const port = Number(process.env.PORT || 8787);
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`Pim API listening on http://${info.address}:${info.port}`);
});

// 防止 Ctrl+C / kill 后 tsx watch 子进程变孤儿：显式关闭 http server
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  // 兜底：3s 后强制退出
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
