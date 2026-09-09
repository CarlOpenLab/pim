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
});

describe("OmpAdapter", () => {
  const setupAdapter = async (files: Record<string, unknown>) => {
    const directory = await temporaryDirectory();
    for (const [name, value] of Object.entries(files))
      await writeFile(join(directory, name), JSON.stringify(value));
    process.env.OMP_AGENT_DIR = directory;
    return new OmpAdapter();
  };

  test("maps every auth.json entry to a credential status", async () => {
    const adapter = await setupAdapter({
      "auth.json": {
        anthropic: { type: "oauth" },
        deepseek: { type: "api", key: "secret", env: { DEEPSEEK_API_KEY: "x" } },
      },
    });

    const config = await adapter.readConfiguration("global", projectPathFixture);

    expect(config.credentials).toEqual([
      { provider: "anthropic", type: "oauth", configured: true, environmentKeys: [] },
      {
        provider: "deepseek",
        type: "api",
        configured: true,
        environmentKeys: ["DEEPSEEK_API_KEY"],
      },
    ]);
  });

  test("exposes the optional capability methods the API routes dispatch on", async () => {
    const adapter = await setupAdapter({});

    expect(typeof adapter.getRolePresets).toBe("function");
    expect(typeof adapter.getAvailableModels).toBe("function");
    expect(typeof adapter.getModelRoles).toBe("function");
    expect(typeof adapter.setModelRoles).toBe("function");
    expect(adapter.getRolePresets?.().length).toBeGreaterThan(0);
    // `omp` is mocked to fail, so the runtime-derived lists degrade to empty.
    await expect(adapter.getAvailableModels!()).resolves.toEqual([]);
    await expect(adapter.getModelRoles!()).resolves.toEqual({});
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

  test("writeModels writes both models.yml and models.json, and restores redacted secrets", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "models.yml"),
      "providers:\n  deepseek:\n    baseUrl: https://api.deepseek.com\n    apiKey: literal-key\n",
    );
    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    await adapter.writeModels({
      providers: {
        deepseek: { baseUrl: "https://api.deepseek.com", apiKey: REDACTED },
      },
    });

    const savedYml = await readFile(join(directory, "models.yml"), "utf8");
    expect(savedYml).toContain("baseUrl: https://api.deepseek.com");
    expect(savedYml).toContain("apiKey: literal-key");

    const savedJson = JSON.parse(await readFile(join(directory, "models.json"), "utf8"));
    expect(savedJson.providers.deepseek.apiKey).toBe("literal-key");
  });

  test("readConfiguration prefers models.yml when present, falls back to models.json", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "models.json"),
      JSON.stringify({
        providers: {
          jsonProvider: { baseUrl: "https://json.example.com", apiKey: "$JSON_KEY" },
        },
      }),
    );
    process.env.OMP_AGENT_DIR = directory;
    const adapter = new OmpAdapter();

    const configJson = await adapter.readConfiguration("global", projectPathFixture);
    expect(configJson.models.data.providers.jsonProvider).toBeDefined();

    // Now write models.yml - it should take precedence
    await writeFile(
      join(directory, "models.yml"),
      "providers:\n  ymlProvider:\n    baseUrl: https://yml.example.com\n    apiKey: $YML_KEY\n",
    );
    const configYml = await adapter.readConfiguration("global", projectPathFixture);
    expect(configYml.models.data.providers.ymlProvider).toBeDefined();
    expect(configYml.models.data.providers.jsonProvider).toBeUndefined();
  });
});
