/**
 * Unified model-preset layer.
 *
 * Every agent that ships provider templates declares a `ModelPresetSource`: its built-in
 * catalog, an optional upstream rebuild for the entry whose models/prices drift, and where
 * a refreshed entry is cached under that agent's own config directory. The HTTP layer talks
 * only to `PresetRegistry`, never to an agent adapter, so preset wiring is independent of
 * configuration I/O — and catalogs can share entries (the OpenCode Go subscription with
 * its upstream refresh, and the Command Code GOAT snapshot) without one agent's code
 * importing another's.
 *
 * A catalog is always the shipped baseline merged with the newest readable cached refresh:
 * the cached entry replaces the baseline row with the same id (or is appended for an id the
 * baseline does not know yet), and everything else stays untouched.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { commandCodeGoatPreset } from "./command-code-goat.js";
import { ompModelPresets } from "./omp.js";
import { openCodeGoPreset, refreshOpenCodeGoPreset } from "./opencode-go.js";
import { piModelPresets } from "./pi.js";
import type { ProviderPreset } from "./types.js";

export interface PresetRefresh {
  /** Rebuilds the refreshable entry from upstream docs. */
  rebuild(fetchImpl: typeof fetch): Promise<ProviderPreset>;
}

export interface ModelPresetSource {
  /** Shipped catalog: what the endpoint returns before any refresh. */
  builtin: ProviderPreset[];
  /** How to rebuild the refreshable entry from upstream docs, when supported. */
  refresh?: PresetRefresh;
  /** Where this agent persists a refreshed entry. */
  cacheFile?: string;
  /** Extra cache files consulted when this agent's own cache is missing. */
  fallbackCacheFiles?: string[];
}

function clonePreset(value: ProviderPreset): ProviderPreset {
  return JSON.parse(JSON.stringify(value)) as ProviderPreset;
}

async function readCachedPreset(path: string): Promise<ProviderPreset | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ProviderPreset;
  } catch {
    return null;
  }
}

async function persistPresetCache(path: string, preset: ProviderPreset): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(preset, null, 2)}\n`, "utf8");
}

/** A refreshed preset replaces its shipped snapshot; the rest stay untouched. */
function mergeCatalog(baseline: ProviderPreset[], cached: ProviderPreset): ProviderPreset[] {
  const index = baseline.findIndex((preset) => preset.id === cached.id);
  if (index < 0) return [...baseline, clonePreset(cached)];
  const next = baseline.slice();
  next[index] = clonePreset(cached);
  return next;
}

export class PresetRegistry {
  constructor(private readonly sources: Record<string, ModelPresetSource>) {}

  private async firstReadableCache(source: ModelPresetSource): Promise<ProviderPreset | null> {
    for (const file of [source.cacheFile, ...(source.fallbackCacheFiles ?? [])]) {
      if (!file) continue;
      const cached = await readCachedPreset(file);
      if (cached) return cached;
    }
    return null;
  }

  /** Model preset catalog for an agent; empty for agents that ship none. */
  async modelPresetsFor(agentId: string): Promise<ProviderPreset[]> {
    const source = this.sources[agentId];
    if (!source) return [];
    const cached = await this.firstReadableCache(source);
    return cached ? mergeCatalog(source.builtin, cached) : source.builtin;
  }

  /**
   * Rebuilds the refreshable entry from upstream docs, persists it under the agent's own
   * config directory, and returns the merged catalog. Agents without a refresh source
   * reject with the same message the API used to produce before.
   */
  async refreshPresetsFor(
    agentId: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<ProviderPreset[]> {
    const source = this.sources[agentId];
    if (!source?.refresh || !source.cacheFile) throw new Error("该 Agent 不支持从文档刷新预设");
    const preset = await source.refresh.rebuild(fetchImpl);
    await persistPresetCache(source.cacheFile, preset);
    return this.modelPresetsFor(agentId);
  }
}

function openCodeGoCacheFile(configDir: string): string {
  return join(configDir, ".pim", "presets", "opencode-go.json");
}

/**
 * The shipped registry: Pi's catalog is its own built-ins (the OpenCode Go and Command Code
 * GOAT entries included), OMP's is its own built-ins plus the same two shared entries
 * appended. Both can rebuild the OpenCode Go entry from the live docs and cache it under
 * their own config directory; OMP falls back to a refresh Pi already cached so a catalog
 * refreshed once shows up for both. The Command Code GOAT entry is a shipped snapshot
 * without an upstream refresh.
 */
export function createPresetRegistry(config: {
  piConfigDir: string;
  ompConfigDir: string;
}): PresetRegistry {
  const piCacheFile = openCodeGoCacheFile(config.piConfigDir);
  return new PresetRegistry({
    pi: {
      builtin: piModelPresets,
      refresh: { rebuild: refreshOpenCodeGoPreset },
      cacheFile: piCacheFile,
    },
    omp: {
      builtin: [...ompModelPresets, openCodeGoPreset, commandCodeGoatPreset],
      refresh: { rebuild: refreshOpenCodeGoPreset },
      cacheFile: openCodeGoCacheFile(config.ompConfigDir),
      fallbackCacheFiles: [piCacheFile],
    },
  });
}
