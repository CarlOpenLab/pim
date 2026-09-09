import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
/// <reference types="vitest/globals" />
import { vi } from "vite-plus/test";
import { OmpAdapter } from "../src/adapters/omp.ts";
import { PiAdapter } from "../src/adapters/pi.ts";
import { REDACTED } from "../src/secret-ref.ts";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "pim-adapters-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
});

/**
 * Both adapters spawn the agent CLI during inspect/read (`pi --version`,
 * `omp config list`). Tests must not depend on either binary being installed, so
 * `pi` execs always fail while `omp` execs succeed as no-ops by default; the
 * `ompFails` switch re-enables failures for the error-aggregation test.
 */
const execState = vi.hoisted(() => ({ ompFails: false }));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const failingExecFile = ((...args: unknown[]) => {
    const file = args[0] as string;
    const callback = args[args.length - 1] as (
      error: Error | null,
      stdout?: string,
      stderr?: string,
    ) => void;
    const fails = file === "pi" || (file === "omp" && execState.ompFails);
    queueMicrotask(() =>
      fails ? callback(new Error("cli unavailable in tests")) : callback(null, "", ""),
    );
    return undefined;
  }) as unknown as typeof execFile;
  return { ...actual, execFile: failingExecFile };
});

afterEach(() => {
  execState.ompFails = false;
});

const projectPathFixture = "/tmp/pim-test-project";

describe("PiAdapter", () => {
  const setupAdapter = async (files: Record<string, unknown>) => {
    const directory = await temporaryDirectory();
    for (const [name, value] of Object.entries(files))
      await writeFile(join(directory, name), JSON.stringify(value));
    process.env.PI_CODING_AGENT_DIR = directory;
    return new PiAdapter();
  };

  test("reads credentials and secret references from the config directory", async () => {
    const adapter = await setupAdapter({
      "auth.json": { deepseek: { type: "api", key: "on disk", env: { DEEPSEEK_API_KEY: "x" } } },
      "models.json": {
        providers: {
          deepseek: { baseUrl: "https://api.deepseek.com", apiKey: "$DEEPSEEK_API_KEY" },
        },
      },
    });

    const config = await adapter.readConfiguration("global", projectPathFixture);

    expect(config.credentials).toEqual([
      {
        provider: "deepseek",
        type: "api",
        configured: true,
        environmentKeys: ["DEEPSEEK_API_KEY"],
      },
    ]);
    expect(config.secretRefs).toEqual([
      { name: "DEEPSEEK_API_KEY", present: false, usedBy: ["deepseek"] },
    ]);
    // Literal values on disk never reach the browser.
    expect(config.models.data.providers.deepseek.apiKey).toBe("$DEEPSEEK_API_KEY");
  });

  test("skips unreadable credential entries instead of throwing", async () => {
    const adapter = await setupAdapter({ "auth.json": { broken: [1, 2, 3] } });

    const config = await adapter.readConfiguration("global", projectPathFixture);

    expect(config.credentials).toEqual([
      { provider: "broken", type: "unknown", configured: false, environmentKeys: [] },
    ]);
  });

  test("writeModels restores redacted literals from the previous file and rejects new ones", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "models.json"),
      JSON.stringify({
        providers: { deepseek: { baseUrl: "https://api.deepseek.com", apiKey: "literal-key" } },
      }),
    );
    process.env.PI_CODING_AGENT_DIR = directory;
    const adapter = new PiAdapter();

    await adapter.writeModels({
      providers: {
        deepseek: { baseUrl: "https://api.deepseek.com", apiKey: REDACTED },
      },
    });
    const saved = JSON.parse(await readFile(join(directory, "models.json"), "utf8"));
    expect(saved.providers.deepseek.apiKey).toBe("literal-key");

    await expect(
      adapter.writeModels({
        providers: { openai: { baseUrl: "https://api.openai.com/v1", apiKey: "sk-plain" } },
      }),
    ).rejects.toThrow(/明文密钥/);
  });

  test("exposes auth management methods", async () => {
    const adapter = await setupAdapter({});

    expect(typeof adapter.checkCredential).toBe("function");
    expect(typeof adapter.listConfiguredProviders).toBe("function");
    expect(typeof adapter.logoutProvider).toBe("function");
  });

  test("checkCredential returns not-configured when pi auth check fails", async () => {
    const adapter = await setupAdapter({});
    // `pi` execs are mocked to fail, so `pi auth check` exits non-zero => not configured.
    const status = await adapter.checkCredential("anthropic");
    expect(status).toEqual({
      provider: "anthropic",
      type: "api",
      configured: false,
      environmentKeys: [],
    });
  });

  test("listConfiguredProviders returns providers from auth.json", async () => {
    const adapter = await setupAdapter({
      "auth.json": {
        anthropic: { type: "api", key: "secret" },
      },
    });
    const providers = await adapter.listConfiguredProviders();
    expect(providers).toEqual(["anthropic"]);
  });

  test("logoutProvider removes credentials from auth.json", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "auth.json"),
      JSON.stringify({
        anthropic: { type: "api", key: "secret" },
        deepseek: { type: "api", key: "secret2" },
      }),
    );
    process.env.PI_CODING_AGENT_DIR = directory;
    const adapter = new PiAdapter();

    const result = await adapter.logoutProvider("anthropic");
    expect(result.success).toBe(true);

    // Verify the credential was removed
    const auth = JSON.parse(await readFile(join(directory, "auth.json"), "utf8"));
    expect(auth).toEqual({ deepseek: { type: "api", key: "secret2" } });
  });

  test("logoutProvider returns error for non-existent provider", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "auth.json"),
      JSON.stringify({ anthropic: { type: "api", key: "secret" } }),
    );
    process.env.PI_CODING_AGENT_DIR = directory;
    const adapter = new PiAdapter();

    const result = await adapter.logoutProvider("nonexistent");
    expect(result.success).toBe(false);
  });

  test("setApiKey saves credentials to auth.json", async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, "auth.json"), JSON.stringify({}));
    process.env.PI_CODING_AGENT_DIR = directory;
    const adapter = new PiAdapter();

    const result = await adapter.setApiKey("anthropic", "sk-test-key");
    expect(result.success).toBe(true);

    // Verify the credential was saved
    const auth = JSON.parse(await readFile(join(directory, "auth.json"), "utf8"));
    expect(auth).toEqual({ anthropic: { type: "api", key: "sk-test-key" } });
  });
});

describe("OmpAdapter", () => {
  const setupAdapter = async (files: Record<string, unknown>) => {
    const directory = await temporaryDirectory();
    for (const [name, value] of Object.entries(files))
      await writeFile(join(directory, name), JSON.stringify(value));
    process.env.OMP_AGENT_DIR = directory;
    return new OmpAdapter();
  };

  test("checks credentials for providers in models.json via omp token", async () => {
    // OMP stores credentials in its own internal storage, accessed via `omp token <provider>`.
    // The adapter checks credentials for each provider defined in models.json.
    const adapter = await setupAdapter({
      "models.json": {
        providers: {
          anthropic: { baseUrl: "https://api.anthropic.com/v1", apiKey: "$ANTHROPIC_API_KEY" },
          deepseek: { baseUrl: "https://api.deepseek.com", apiKey: "$DEEPSEEK_API_KEY" },
        },
      },
    });

    const config = await adapter.readConfiguration("global", projectPathFixture);

    // In tests, `omp` execs are mocked to succeed with empty stdout,
    // so `omp token <provider>` returns empty string => not configured.
    expect(config.credentials).toEqual([
      { provider: "anthropic", type: "api", configured: false, environmentKeys: [] },
      { provider: "deepseek", type: "api", configured: false, environmentKeys: [] },
    ]);
  });

  test("returns empty credentials when models.json has no providers", async () => {
    const adapter = await setupAdapter({});

    const config = await adapter.readConfiguration("global", projectPathFixture);

    expect(config.credentials).toEqual([]);
  });

  test("exposes the optional capability methods the API routes dispatch on", async () => {
    const adapter = await setupAdapter({});

    expect(typeof adapter.getRolePresets).toBe("function");
    expect(typeof adapter.getAvailableModels).toBe("function");
    expect(typeof adapter.getModelRoles).toBe("function");
    expect(typeof adapter.setModelRoles).toBe("function");
    expect(typeof adapter.logoutProvider).toBe("function");
    expect(typeof adapter.checkCredential).toBe("function");
    expect(adapter.getRolePresets?.().length).toBeGreaterThan(0);
    // `omp` is mocked to fail, so the runtime-derived lists degrade to empty.
    await expect(adapter.getAvailableModels!()).resolves.toEqual([]);
    await expect(adapter.getModelRoles!()).resolves.toEqual({});
  });

  test("checkCredential returns not-configured when omp token fails", async () => {
    const adapter = await setupAdapter({});
    // `omp` execs are mocked to succeed with empty stdout, which means
    // `omp token <provider>` returns empty => not configured.
    const status = await adapter.checkCredential("anthropic");
    expect(status).toEqual({
      provider: "anthropic",
      type: "api",
      configured: false,
      environmentKeys: [],
    });
  });

  test("logoutProvider method exists", async () => {
    const adapter = await setupAdapter({});
    expect(typeof adapter.logoutProvider).toBe("function");
  });

  test("writeSettings persists non-runtime keys to settings.json", async () => {
    const directory = await temporaryDirectory();
    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    const result = await adapter.writeSettings("global", projectPathFixture, {
      theme: "light",
      quietStartup: true,
    });

    expect(result.path).toBe(join(directory, "settings.json"));
    const saved = JSON.parse(await readFile(result.path, "utf8"));
    expect(saved).toEqual({ theme: "light", quietStartup: true });
  });

  test("writeSettings reports which omp config keys failed instead of aborting silently", async () => {
    execState.ompFails = true;
    const adapter = await setupAdapter({});

    // `omp config set` fails here (mocked execFile), so the runtime keys must
    // surface a single aggregated error naming each failed key.
    await expect(
      adapter.writeSettings("global", projectPathFixture, {
        defaultThinkingLevel: "high",
        compaction: { enabled: false },
      }),
    ).rejects.toThrow(/defaultThinkingLevel.*compaction\.enabled/s);
  });

  test("writeSettings reports keys moved from settings.json into omp config", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "settings.json"),
      JSON.stringify({ defaultThinkingLevel: "medium", theme: "dark" }),
    );
    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    const result = await adapter.writeSettings("global", projectPathFixture, {
      defaultThinkingLevel: "high",
      theme: "dark",
    });

    expect(result.migratedKeys).toEqual(["defaultThinkingLevel"]);
    const saved = JSON.parse(await readFile(join(directory, "settings.json"), "utf8"));
    // The migrated key must be gone from the file; regular keys stay.
    expect(saved).toEqual({ theme: "dark" });
  });

  test("setApiKey saves credential to agent.db and checkCredential reflects it", async () => {
    const directory = await temporaryDirectory();
    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    const saveResult = await adapter.setApiKey("deepseek", "sk-omp-test-key");
    expect(saveResult.success).toBe(true);

    const status = await adapter.checkCredential("deepseek");
    expect(status).toEqual({
      provider: "deepseek",
      type: "api",
      configured: true,
      environmentKeys: [],
    });

    const config = await adapter.readConfiguration("global", projectPathFixture);
    expect(config.credentials).toContainEqual({
      provider: "deepseek",
      type: "api",
      configured: true,
      environmentKeys: [],
    });

    const logoutResult = await adapter.logoutProvider("deepseek");
    expect(logoutResult.success).toBe(true);

    const statusAfter = await adapter.checkCredential("deepseek");
    expect(statusAfter.configured).toBe(false);
  });

  test("reads models from nested agent/models.yml when present", async () => {
    const directory = await temporaryDirectory();
    const agentDir = join(directory, "agent");
    const { mkdir } = await import("node:fs/promises");
    const { stringify } = await import("yaml");
    await mkdir(agentDir, { recursive: true });

    const sampleConfig = {
      providers: {
        custom: {
          baseUrl: "https://custom.ai/v1",
          api: "openai-completions",
          models: [{ id: "custom-1", name: "Custom 1" }],
        },
      },
    };
    await writeFile(join(agentDir, "models.yml"), stringify(sampleConfig), "utf8");

    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();
    const config = await adapter.readConfiguration("global", projectPathFixture);

    expect(config.models.data.providers.custom).toBeDefined();
    expect(config.models.data.providers.custom.baseUrl).toBe("https://custom.ai/v1");
  });

  test("writeModels writes to both models.json and models.yml, adapting auth for credentials in agent.db", async () => {
    const directory = await temporaryDirectory();
    const agentDir = join(directory, "agent");
    const { mkdir } = await import("node:fs/promises");
    const { parse } = await import("yaml");
    await mkdir(agentDir, { recursive: true });

    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    // Configure an API key for "custom" in agent.db
    await adapter.setApiKey("custom", "sk-custom-secret");

    const saveResult = await adapter.writeModels({
      providers: {
        custom: {
          baseUrl: "https://custom.ai/v1",
          api: "openai-completions",
          apiKey: "$CUSTOM_API_KEY",
          models: [{ id: "custom-1", name: "Custom 1" }],
        },
      },
    });

    expect(saveResult.path).toBe(join(directory, "models.json"));

    // Verify models.json in root
    const rootJson = JSON.parse(await readFile(join(directory, "models.json"), "utf8"));
    expect(rootJson.providers.custom.apiKey).toBe("$CUSTOM_API_KEY");

    // Verify models.json in agent/
    const agentJson = JSON.parse(await readFile(join(agentDir, "models.json"), "utf8"));
    expect(agentJson.providers.custom.apiKey).toBe("$CUSTOM_API_KEY");

    // Verify models.yml in agent/ has auth: oauth and apiKey removed for the active credential
    const agentYmlContent = await readFile(join(agentDir, "models.yml"), "utf8");
    const agentYml = parse(agentYmlContent);
    expect(agentYml.providers.custom.auth).toBe("oauth");
    expect(agentYml.providers.custom.apiKey).toBeUndefined();
  });
});
