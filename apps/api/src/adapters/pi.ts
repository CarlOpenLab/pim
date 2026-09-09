import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
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

const thinkingLevel = z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
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

// Messages are user facing: the advanced JSON editor surfaces them verbatim in a toast.
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

export class PiAdapter implements AgentAdapter {
  readonly id = "pi" as const;
  readonly configDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");

  async inspect(): Promise<AgentSummary> {
    let version: string | null = null;
    try {
      const result = await execFileAsync("pi", ["--version"], { timeout: 3000 });
      version = result.stdout.trim() || result.stderr.trim() || null;
    } catch {
      version = null;
    }

    return {
      id: this.id,
      name: "Pi",
      description: "Minimal terminal coding harness",
      available: version !== null,
      version,
      configDir: this.configDir,
      capabilities: ["settings", "providers", "models", "keybindings"],
    };
  }

  async readConfiguration(scope: ConfigScope, projectPath: string): Promise<AgentConfiguration> {
    const root = projectRoot(projectPath);
    const settingsPath =
      scope === "global"
        ? join(this.configDir, "settings.json")
        : join(root, ".pi", "settings.json");
    const modelsPath = join(this.configDir, "models.json");
    const authPath = join(this.configDir, "auth.json");

    const [agent, settings, models, auth] = await Promise.all([
      this.inspect(),
      readJsonDocument(settingsPath, {}, (value) => settingsSchema.parse(value)),
      readJsonDocument(modelsPath, { providers: {} }, (value) => modelsSchema.parse(value)),
      readJsonDocument(authPath, {}, (value) => recordSchema.parse(value)),
    ]);

    const modelProviderIds = Object.keys(models.data.providers ?? {});
    const authProviderIds = Object.keys(auth.data);
    const allProviderIds = Array.from(new Set([...modelProviderIds, ...authProviderIds]));

    const credentials: CredentialStatus[] = allProviderIds.map((provider) => {
      if (provider in auth.data) {
        const credential = recordSchema.safeParse(auth.data[provider]);
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
      }
      return {
        provider,
        type: "api",
        configured: false,
        environmentKeys: [],
      };
    });

    return {
      agent,
      scope,
      projectPath: root,
      settings,
      models: { ...models, data: sanitizeModels(models.data) },
      credentials,
      secretRefs: collectSecretReferences(models.data),
    };
  }

  async writeSettings(
    scope: ConfigScope,
    projectPath: string,
    value: Record<string, unknown>,
  ): Promise<SaveResult> {
    const parsed = settingsSchema.parse(value);
    const root = projectRoot(projectPath);
    const path =
      scope === "global"
        ? join(this.configDir, "settings.json")
        : join(root, ".pi", "settings.json");
    return writeJsonAtomic(path, parsed);
  }

  async writeModels(value: ModelsConfiguration): Promise<SaveResult> {
    const parsed = modelsSchema.parse(value) as ModelsConfiguration;
    assertNoLiteralSecrets(parsed);
    const path = join(this.configDir, "models.json");
    const previous = await readJsonDocument(path, { providers: {} }, (input) =>
      modelsSchema.parse(input),
    );
    return writeJsonAtomic(path, restoreSecrets(parsed, previous.data));
  }

  /**
   * Checks whether a provider has credentials configured via `pi auth check`.
   * Pi stores credentials in auth.json.
   */
  async checkCredential(providerId: string): Promise<CredentialStatus> {
    try {
      const { stdout } = await execFileAsync(
        "pi",
        ["auth", "check", "--provider", providerId, "--json"],
        { timeout: 5000 },
      );
      const parsed = JSON.parse(stdout) as { status: string; authType?: string };
      return {
        provider: providerId,
        type: parsed.authType ?? "api",
        configured: parsed.status === "ready",
        environmentKeys: [],
      };
    } catch {
      // `pi auth check` exits non-zero when no credential is configured.
      return {
        provider: providerId,
        type: "api",
        configured: false,
        environmentKeys: [],
      };
    }
  }

  /**
   * Lists providers that have credentials configured in Pi's auth.json.
   */
  async listConfiguredProviders(): Promise<string[]> {
    const authPath = join(this.configDir, "auth.json");
    try {
      const auth = await readJsonDocument(authPath, {}, (value) => recordSchema.parse(value));
      return Object.keys(auth.data);
    } catch {
      return [];
    }
  }

  /**
   * Removes a provider's credentials from Pi's auth.json.
   */
  async logoutProvider(providerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const authPath = join(this.configDir, "auth.json");
      const auth = await readJsonDocument(authPath, {}, (value) => recordSchema.parse(value));
      if (!(providerId in auth.data)) {
        return { success: false, message: `Provider "${providerId}" 没有配置的凭据` };
      }
      delete (auth.data as Record<string, unknown>)[providerId];
      await writeJsonAtomic(authPath, auth.data);
      return { success: true, message: `已移除 ${providerId} 的凭据` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "移除凭据失败" };
    }
  }

  /**
   * Sets an API Key for a provider in Pi's auth.json.
   */
  async setApiKey(
    providerId: string,
    apiKey: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const authPath = join(this.configDir, "auth.json");
      const auth = await readJsonDocument(authPath, {}, (value) => recordSchema.parse(value));
      (auth.data as Record<string, unknown>)[providerId] = {
        type: "api",
        key: apiKey,
      };
      await writeJsonAtomic(authPath, auth.data);
      return { success: true, message: `已保存 ${providerId} 的 API Key` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "保存 API Key 失败",
      };
    }
  }
}

/** Exported so a test can assert every shipped preset still satisfies the write schema. */
export const piModelsSchema = modelsSchema;
