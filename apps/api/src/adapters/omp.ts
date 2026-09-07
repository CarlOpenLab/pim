import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { ompRolePresets } from "../presets/omp.js";
import {
  assertNoLiteralSecrets,
  collectSecretReferences,
  isSecretPlaceholder,
  REDACTED,
} from "../secret-ref.js";
import { readJsonDocument, writeJsonAtomic } from "./json-file.js";
import type {
  AgentAdapter,
  AgentConfiguration,
  AgentSummary,
  ConfigScope,
  CredentialStatus,
  ModelsConfiguration,
  SaveResult,
} from "./types.js";

const execFileAsync = promisify(execFile);

const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  prompt: z.string().optional(),
  icon: z.string().optional(),
  accent: z.string().optional(),
});

const thinkingLevel = z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

const modelRolesSchema = z.record(z.string(), z.string()).optional();

const terminalSchema = z
  .object({
    theme: z.enum(["dark", "light", "auto"]).optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().int().min(8).max(24).optional(),
    lineHeight: z.number().min(1).max(2).optional(),
    opacity: z.number().min(0.3).max(1).optional(),
    blur: z.boolean().optional(),
    cursorStyle: z.enum(["block", "underline", "bar"]).optional(),
    cursorBlink: z.boolean().optional(),
    background: z.string().optional(),
    accent: z.string().optional(),
  })
  .loose()
  .optional();

const settingsSchema = z
  .object({
    defaultProvider: z.string().min(1).optional(),
    defaultModel: z.string().min(1).optional(),
    defaultThinkingLevel: thinkingLevel.optional(),
    theme: z.string().min(1).optional(),
    defaultProjectTrust: z.enum(["ask", "always", "never"]).optional(),
    quietStartup: z.boolean().optional(),
    hideThinkingBlock: z.boolean().optional(),
    enableInstallTelemetry: z.boolean().optional(),
    steeringMode: z.enum(["all", "one-at-a-time"]).optional(),
    followUpMode: z.enum(["all", "one-at-a-time"]).optional(),
    transport: z.enum(["sse", "websocket", "websocket-cached", "auto"]).optional(),
    enabledModels: z.array(z.string().min(1)).optional(),
    modelRoles: modelRolesSchema,
    cycleOrder: z.array(z.string().min(1)).optional(),
    modelRoleStorage: z.enum(["global", "project"]).optional(),
    activeRole: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    persona: z.string().optional(),
    roles: z.array(roleSchema).optional(),
    terminal: terminalSchema,
    compaction: z
      .object({
        enabled: z.boolean().optional(),
        reserveTokens: z.number().int().nonnegative().optional(),
        keepRecentTokens: z.number().int().nonnegative().optional(),
      })
      .loose()
      .optional(),
    retry: z
      .object({
        enabled: z.boolean().optional(),
        maxRetries: z.number().int().nonnegative().optional(),
        baseDelayMs: z.number().int().nonnegative().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

const modelSchema = z
  .object({
    id: z.string().min(1, "模型 ID 不能为空"),
    name: z.string().optional(),
    reasoning: z.boolean().optional(),
    input: z.array(z.enum(["text", "image"])).optional(),
    contextWindow: z.number("上下文窗口需要是正整数").int().positive().optional(),
    maxTokens: z.number("最大输出需要是正整数").int().positive().optional(),
  })
  .loose();

const providerSchema = z
  .object({
    baseUrl: z.url().or(z.string().startsWith("http://localhost")).optional(),
    api: z
      .enum([
        "openai-completions",
        "openai-responses",
        "anthropic-messages",
        "google-generative-ai",
      ])
      .optional(),
    apiKey: z.string().optional(),
    oauth: z.string().optional(),
    authHeader: z.boolean().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    models: z.array(modelSchema).optional(),
    modelOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .loose();

const modelsSchema = z.object({ providers: z.record(z.string(), providerSchema) }).loose();
const recordSchema = z.record(z.string(), z.unknown());

export type OmpAvailableModel = {
  provider: string;
  id: string;
  selector: string;
  name: string;
  reasoning: boolean;
  thinking: string[];
  input: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
};

async function fetchOmpConfigMap(): Promise<Map<string, unknown>> {
  try {
    const { stdout } = await execFileAsync("omp", ["config", "list", "--json"], { timeout: 5000 });
    const parsed = JSON.parse(stdout) as Record<string, { value: unknown }>;
    const map = new Map<string, unknown>();
    for (const [key, entry] of Object.entries(parsed)) map.set(key, entry.value);
    return map;
  } catch {
    return new Map();
  }
}

async function fetchOmpModelRoles(): Promise<Record<string, string>> {
  const map = await fetchOmpConfigMap();
  const v = map.get("modelRoles");
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, string>;
  try {
    const { stdout } = await execFileAsync("omp", ["config", "get", "modelRoles", "--json"], {
      timeout: 3000,
    });
    const parsed = JSON.parse(stdout) as { value: unknown };
    if (parsed.value && typeof parsed.value === "object")
      return parsed.value as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

async function fetchAvailableModels(): Promise<OmpAvailableModel[]> {
  try {
    const { stdout } = await execFileAsync("omp", ["models", "--json"], { timeout: 8000 });
    const parsed = JSON.parse(stdout) as { models: OmpAvailableModel[] };
    if (Array.isArray(parsed.models)) return parsed.models;
    return [];
  } catch {
    return [];
  }
}

async function writeOmpModelRoles(roles: Record<string, string>): Promise<void> {
  const payload = JSON.stringify(roles);
  await execFileAsync("omp", ["config", "set", "modelRoles", payload], { timeout: 5000 });
}

async function writeOmpConfig(key: string, value: unknown): Promise<void> {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  await execFileAsync("omp", ["config", "set", key, payload], { timeout: 5000 });
}

function setNested(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function projectRoot(path: string): string {
  const normalized = resolve(path);
  if (!isAbsolute(normalized)) throw new Error("Project path must be absolute");
  return normalized;
}

function sanitizeSecrets(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeSecrets(item, parentKey));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const isSensitiveString =
        typeof item === "string" &&
        (key === "apiKey" || key === "oauth" || parentKey === "headers") &&
        !isSecretPlaceholder(item);
      return [key, isSensitiveString ? REDACTED : sanitizeSecrets(item, key)];
    }),
  );
}

function restoreRedactions(next: unknown, previous: unknown): unknown {
  if (next === REDACTED) return previous ?? next;
  if (Array.isArray(next)) {
    const previousItems = Array.isArray(previous) ? previous : [];
    return next.map((item, index) => restoreRedactions(item, previousItems[index]));
  }
  if (!next || typeof next !== "object") return next;
  const previousRecord =
    previous && typeof previous === "object" ? (previous as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(next).map(([key, item]) => [key, restoreRedactions(item, previousRecord[key])]),
  );
}

export function sanitizeModels(value: ModelsConfiguration): ModelsConfiguration {
  return sanitizeSecrets(value) as ModelsConfiguration;
}

export function restoreSecrets(
  next: ModelsConfiguration,
  previous: ModelsConfiguration,
): ModelsConfiguration {
  return restoreRedactions(next, previous) as ModelsConfiguration;
}

export class OmpAdapter implements AgentAdapter {
  readonly id = "omp" as const;
  readonly configDir =
    process.env.OMP_AGENT_DIR || process.env.OMP_CONFIG_DIR || join(homedir(), ".omp");

  async inspect(): Promise<AgentSummary> {
    let version: string | null = null;
    for (const cmd of ["omp", "omp-cli"]) {
      try {
        const result = await execFileAsync(cmd, ["--version"], { timeout: 3000 });
        version = result.stdout.trim() || result.stderr.trim() || null;
        if (version) break;
      } catch {
        // try next
      }
    }
    return {
      id: this.id,
      name: "OMP",
      description: "OMP · 角色化终端 Agent",
      available: version !== null,
      version,
      configDir: this.configDir,
      capabilities: [
        "settings",
        "model",
        "providers",
        "models",
        "persona",
        "credentials",
        // legacy aliases kept hidden but do not drive tabs
        "modelRoles",
        "roles",
      ],
    };
  }

  async readConfiguration(scope: ConfigScope, projectPath: string): Promise<AgentConfiguration> {
    const root = projectRoot(projectPath);
    const settingsPath =
      scope === "global"
        ? join(this.configDir, "settings.json")
        : join(root, ".omp", "settings.json");
    const modelsPath = join(this.configDir, "models.json");
    const authPath = join(this.configDir, "auth.json");

    const [agent, settings, models, auth, ompConfigMap] = await Promise.all([
      this.inspect(),
      readJsonDocument(settingsPath, {}, (value) => settingsSchema.parse(value)),
      readJsonDocument(modelsPath, { providers: {} }, (value) => modelsSchema.parse(value)),
      readJsonDocument(authPath, {}, (value) => recordSchema.parse(value)),
      fetchOmpConfigMap(),
    ]);

    const modelRoles = ompConfigMap.get("modelRoles");
    if (modelRoles && typeof modelRoles === "object" && !Array.isArray(modelRoles)) {
      (settings.data as Record<string, unknown>).modelRoles = modelRoles;
    } else {
      const fallback = await fetchOmpModelRoles();
      if (Object.keys(fallback).length)
        (settings.data as Record<string, unknown>).modelRoles = fallback;
    }
    const cycleOrder = ompConfigMap.get("cycleOrder");
    if (Array.isArray(cycleOrder))
      (settings.data as Record<string, unknown>).cycleOrder = cycleOrder;

    // 将 omp config 中与 settingsSchema 对应的键合并进 settings.data，
    // 以解决“下拉都是空的”：直接读 config.yml 的真实值，而非依赖空的 settings.json
    const directKeys: Record<string, true> = {
      defaultProvider: true,
      defaultModel: true,
      defaultThinkingLevel: true,
      theme: true,
      defaultProjectTrust: true,
      quietStartup: true,
      hideThinkingBlock: true,
      enableInstallTelemetry: true,
      steeringMode: true,
      followUpMode: true,
      transport: true,
      enabledModels: true,
      modelRoleStorage: true,
      activeRole: true,
      role: true,
      persona: true,
    };
    for (const [k, v] of ompConfigMap.entries()) {
      if (k === "modelRoles" || k === "cycleOrder") continue;
      if (k.includes(".")) {
        if (k.startsWith("compaction.") || k.startsWith("retry.") || k.startsWith("terminal.")) {
          setNested(settings.data as Record<string, unknown>, k, v);
        }
      } else if (directKeys[k]) {
        (settings.data as Record<string, unknown>)[k] = v;
      }
    }
    const data = settings.data as Record<string, unknown>;
    if (!Array.isArray(data.roles) || data.roles.length === 0) {
      // keep empty, frontend uses presets
    }

    const credentials: CredentialStatus[] = Object.entries(auth.data).map(([provider, value]) => {
      const credential = recordSchema.safeParse(value);
      const data = credential.success ? credential.data : {};
      return {
        provider,
        type: typeof data.type === "string" ? data.type : "unknown",
        configured: typeof data.key === "string" || data.type === "oauth",
        environmentKeys:
          data.env && typeof data.env === "object"
            ? Object.keys(data.env as Record<string, unknown>)
            : [],
      };
    });

    return {
      agent,
      scope,
      projectPath: root,
      settings,
      models: {
        ...models,
        data: sanitizeModels(models.data as ModelsConfiguration) as unknown as typeof models.data,
      },
      credentials,
      secretRefs: collectSecretReferences(models.data as ModelsConfiguration),
    };
  }

  async writeSettings(
    scope: ConfigScope,
    projectPath: string,
    value: Record<string, unknown>,
  ): Promise<SaveResult> {
    const parsed = settingsSchema.parse(value) as Record<string, unknown>;
    const modelRoles = parsed.modelRoles as Record<string, string> | undefined;
    const cycleOrder = parsed.cycleOrder as string[] | undefined;

    // 除 modelRoles/cycleOrder 外，omp 原生配置也应通过 `omp config set` 写入，
    // 否则下拉显示恢复成空（原实现只写 settings.json，omp 根本不读）
    const ompDirectKeys: Record<string, true> = {
      defaultThinkingLevel: true,
      enabledModels: true,
      modelRoleStorage: true,
      activeRole: true,
    };
    const pendingWrites: Array<[string, unknown]> = [];
    for (const [k, v] of Object.entries(parsed)) {
      if (k === "modelRoles" || k === "cycleOrder") continue;
      if (ompDirectKeys[k] && v !== undefined) pendingWrites.push([k, v]);
      else if ((k === "compaction" || k === "retry") && v && typeof v === "object") {
        for (const [sub, sv] of Object.entries(v as Record<string, unknown>)) {
          if (sv !== undefined) pendingWrites.push([`${k}.${sub}`, sv]);
        }
      }
    }

    // `omp config set` is per-key, so one save spawns several processes. Failures are
    // collected instead of aborting mid-way, and reported together afterwards.
    const failures: string[] = [];
    const trySet = async (key: string, value: unknown) => {
      try {
        await writeOmpConfig(key, value);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${key}（${reason.trim()}）`);
      }
    };
    if (modelRoles !== undefined) await trySet("modelRoles", modelRoles);
    if (cycleOrder !== undefined) await trySet("cycleOrder", cycleOrder);
    for (const [k, v] of pendingWrites) {
      await trySet(k, v);
    }
    if (failures.length > 0)
      throw new Error(`以下配置写入 omp config 失败：${failures.join("；")}`);

    const rest = { ...parsed };
    delete rest.modelRoles;
    delete rest.cycleOrder;
    // 已通过 omp config 持久化的键不再写入 settings.json
    for (const [k] of pendingWrites) {
      const top = k.split(".")[0]!;
      if (top === "compaction" || top === "retry") {
        // 保留顶层对象但移除已写入的子键，剩余走 settings.json（如自定义 terminal）
        const group = rest[top] as Record<string, unknown> | undefined;
        if (group && typeof group === "object") {
          delete group[k.split(".")[1]!];
          if (Object.keys(group).length === 0) delete rest[top];
        }
      } else delete rest[k];
    }
    const root = projectRoot(projectPath);
    const path =
      scope === "global"
        ? join(this.configDir, "settings.json")
        : join(root, ".omp", "settings.json");

    // Keys that used to live in settings.json but are now stored by the omp runtime:
    // reported back so the UI can say the file was reshaped instead of silently rewritten.
    const previous = await readJsonDocument(path, {}, (value) => recordSchema.parse(value));
    const runtimeKeys = new Set<string>(["modelRoles", "cycleOrder", "compaction", "retry"]);
    for (const key of Object.keys(ompDirectKeys)) runtimeKeys.add(key);
    const migratedKeys = Object.keys(previous.data).filter(
      (key) => !(key in rest) && runtimeKeys.has(key),
    );

    if (Object.keys(rest).length === 0) {
      return { path, backupPath: null, savedAt: new Date().toISOString(), migratedKeys };
    }
    const result = await writeJsonAtomic(path, rest);
    return migratedKeys.length ? { ...result, migratedKeys } : result;
  }
  async writeModels(value: ModelsConfiguration): Promise<SaveResult> {
    const parsed = modelsSchema.parse(value) as ModelsConfiguration;
    assertNoLiteralSecrets(parsed);
    const path = join(this.configDir, "models.json");
    const previous = await readJsonDocument(path, { providers: {} }, (input) =>
      modelsSchema.parse(input),
    );
    return writeJsonAtomic(path, restoreSecrets(parsed, previous.data as ModelsConfiguration));
  }

  getRolePresets() {
    return ompRolePresets;
  }

  async getAvailableModels(): Promise<OmpAvailableModel[]> {
    return fetchAvailableModels();
  }

  async getModelRoles(): Promise<Record<string, string>> {
    return fetchOmpModelRoles();
  }

  async setModelRoles(roles: Record<string, string>): Promise<Record<string, string>> {
    await writeOmpModelRoles(roles);
    return roles;
  }
}

export const ompModelsSchema = modelsSchema;
export const ompSettingsSchema = settingsSchema;
