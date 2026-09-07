/// <reference types="vitest/globals" />
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { commandCodeGoatPreset } from "../src/presets/command-code-goat.ts";
import { ompModelPresets } from "../src/presets/omp.ts";
import { openCodeGoPreset } from "../src/presets/opencode-go.ts";
import { piModelPresets } from "../src/presets/pi.ts";
import { createPresetRegistry } from "../src/presets/registry.ts";
import type { ProviderPreset } from "../src/presets/types.ts";
import { openCodeGoDocsHtml } from "./fixtures/opencode-go-docs.ts";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "pim-presets-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function cacheFile(configDir: string): string {
  return join(configDir, ".pim", "presets", "opencode-go.json");
}

async function writePreset(configDir: string, preset: ProviderPreset): Promise<void> {
  const path = cacheFile(configDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(preset, null, 2)}\n`, "utf8");
}

function openCodePreset(label: string): ProviderPreset {
  return {
    id: "opencode-go",
    label,
    description: "Refreshed from the live docs.",
    docsUrl: "https://opencode.ai/docs/zh-cn/go/",
    provider: { baseUrl: "https://opencode.ai/zen/go/v1", api: "openai-completions" },
    models: [{ id: "fresh-model", name: "Fresh Model", reasoning: true, input: ["text"] }],
  };
}

async function setupRegistry() {
  const piDir = await temporaryDirectory();
  const ompDir = await temporaryDirectory();
  return {
    piDir,
    ompDir,
    registry: createPresetRegistry({ piConfigDir: piDir, ompConfigDir: ompDir }),
  };
}

describe("PresetRegistry", () => {
  test("serves the shipped catalog when nothing is cached", async () => {
    const { registry } = await setupRegistry();

    await expect(registry.modelPresetsFor("pi")).resolves.toEqual(piModelPresets);
    // OMP's catalog is its own providers plus the two shared entries appended:
    // the OpenCode Go subscription and the Command Code GOAT snapshot.
    const ompCatalog = await registry.modelPresetsFor("omp");
    expect(ompCatalog.slice(0, ompModelPresets.length)).toEqual(ompModelPresets);
    expect(ompCatalog[ompCatalog.length - 2]).toEqual(openCodeGoPreset);
    expect(ompCatalog[ompCatalog.length - 1]).toEqual(commandCodeGoatPreset);
    expect(ompCatalog).toHaveLength(ompModelPresets.length + 2);
  });

  test("returns empty for agents that ship no model presets", async () => {
    const { registry } = await setupRegistry();
    await expect(registry.modelPresetsFor("ghost")).resolves.toEqual([]);
  });

  test("a cached refresh replaces the baseline entry in place, leaving the rest untouched", async () => {
    const { piDir, registry } = await setupRegistry();
    const refreshed = openCodePreset("已刷新");
    await writePreset(piDir, refreshed);

    const catalog = await registry.modelPresetsFor("pi");
    expect(catalog).toHaveLength(piModelPresets.length);
    const index = catalog.findIndex((preset) => preset.id === "opencode-go");
    expect(catalog[index]).toEqual(refreshed);
    // Unrelated rows keep both position and content.
    expect(catalog.map((preset) => preset.id)).toEqual(piModelPresets.map((preset) => preset.id));
    expect(catalog[0]).toEqual(piModelPresets[0]);
  });

  test("a cached entry whose id the baseline lacks is appended", async () => {
    const { piDir, registry } = await setupRegistry();
    const brandNew = { id: "brand-new", label: "New", description: "d", provider: {}, models: [] };
    await writePreset(piDir, brandNew);

    const catalog = await registry.modelPresetsFor("pi");
    expect(catalog).toHaveLength(piModelPresets.length + 1);
    expect(catalog[catalog.length - 1]).toEqual(brandNew);
  });

  test("an unreadable cache file degrades to the shipped catalog", async () => {
    const { piDir, registry } = await setupRegistry();
    await mkdir(dirname(cacheFile(piDir)), { recursive: true });
    await writeFile(cacheFile(piDir), "not json", "utf8");

    await expect(registry.modelPresetsFor("pi")).resolves.toEqual(piModelPresets);
  });

  test("OMP prefers its own cache over a Pi refresh it falls back to", async () => {
    const { piDir, ompDir, registry } = await setupRegistry();
    await writePreset(piDir, openCodePreset("来自 Pi 刷新"));
    await writePreset(ompDir, openCodePreset("来自 OMP 刷新"));

    const ompCatalog = await registry.modelPresetsFor("omp");
    expect(ompCatalog.find((preset) => preset.id === "opencode-go")?.label).toBe("来自 OMP 刷新");

    // Without an OMP cache the Pi refresh still shows up, so a catalog refreshed once
    // is visible to both agents.
    await rm(cacheFile(ompDir));
    const fallback = await registry.modelPresetsFor("omp");
    expect(fallback.find((preset) => preset.id === "opencode-go")?.label).toBe("来自 Pi 刷新");
  });

  test("refresh rebuilds from upstream, persists under the agent's own dir, and merges", async () => {
    const { piDir, ompDir, registry } = await setupRegistry();
    const fetchStub = async () => new Response(openCodeGoDocsHtml, { status: 200 });

    const catalog = await registry.refreshPresetsFor("pi", fetchStub);
    const opencode = catalog.find((preset) => preset.id === "opencode-go")!;
    expect(opencode.models).toHaveLength(8);
    expect(catalog).toHaveLength(piModelPresets.length);

    // Persisted under Pi's config dir, and OMP's own dir stays untouched.
    const persisted = JSON.parse(await readFile(cacheFile(piDir), "utf8"));
    expect(persisted.id).toBe("opencode-go");
    expect(persisted.models).toHaveLength(8);
    await expect(readFile(cacheFile(ompDir), "utf8")).rejects.toThrow();

    // A later refresh through OMP writes to OMP's dir, not Pi's.
    const ompCatalog = await registry.refreshPresetsFor("omp", fetchStub);
    expect(ompCatalog.find((preset) => preset.id === "opencode-go")?.models).toHaveLength(8);
    await expect(readFile(cacheFile(ompDir), "utf8")).resolves.toContain("opencode-go");
  });

  test("rejects refresh for sources without one", async () => {
    const { registry } = await setupRegistry();
    await expect(registry.refreshPresetsFor("ghost")).rejects.toThrow(/不支持从文档刷新预设/);
  });
});
