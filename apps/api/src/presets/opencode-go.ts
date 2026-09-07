/**
 * The OpenCode Go preset and its upstream refresh.
 *
 * `openCodeGoPreset` is the shipped snapshot (connection fields, description, and the
 * models known at ship time). It is shared by every agent catalog that offers the
 * OpenCode Go subscription, so a refresh or a fix lands once. The rest of this module
 * re-reads the live docs: vendors ship models and change prices whenever they want, so
 * the two tables the docs publish are parsed and the model rows are rebuilt from them:
 *
 * - a model catalog table: display name, model ID, endpoint, SDK binding
 * - a pricing table: input / output / cache-read / cache-write rates per 1M tokens
 *
 * Only the rows that look like data are picked out, so the page can be re-styled without
 * breaking the parse. Costs are US dollars per million tokens (cache-write of "-" means the
 * model has no prompt caching tier).
 */
import type { ModelConfiguration, ProviderPreset } from "./types.js";

export const openCodeGoDocsUrl = "https://opencode.ai/docs/zh-cn/go/";

export const openCodeGoPreset: ProviderPreset = {
  id: "opencode-go",
  label: "OpenCode Go",
  description:
    "OpenCode 的低成本开源编程模型订阅服务（首月 $5，之后 $10/月）。统一网关下聚合多家开源模型，按模型自动路由到 Chat Completions、Responses 或 Messages 接口；密钥在 OpenCode Zen 控制台获取，设为 $OPENCODE_API_KEY。模型与价格可随时点击「刷新预设」从官网文档同步。",
  docsUrl: "https://opencode.ai/docs/zh-cn/go/",
  provider: {
    baseUrl: "https://opencode.ai/zen/go/v1",
    api: "openai-completions",
    apiKey: "$OPENCODE_API_KEY",
  },
  models: [
    {
      id: "grok-4.5",
      name: "Grok 4.5",
      reasoning: true,
      input: ["text"],
      api: "openai-responses",
      cost: { input: 2, output: 6, cacheRead: 0.3, cacheWrite: 0 },
    },
    {
      id: "glm-5.2",
      name: "GLM-5.2",
      reasoning: true,
      input: ["text"],
      cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    },
    {
      id: "glm-5.1",
      name: "GLM-5.1",
      reasoning: true,
      input: ["text"],
      cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    },
    {
      id: "glm-5.3",
      name: "GLM-5.3",
      reasoning: true,
      input: ["text"],
      cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    },
    {
      id: "kimi-k3",
      name: "Kimi K3",
      reasoning: true,
      input: ["text"],
      cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 },
    },
    {
      id: "kimi-k2.7-code",
      name: "Kimi K2.7 Code",
      reasoning: true,
      input: ["text"],
      cost: { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
    },
    {
      id: "kimi-k2.6",
      name: "Kimi K2.6",
      reasoning: true,
      input: ["text"],
      cost: { input: 0.95, output: 4, cacheRead: 0.16, cacheWrite: 0 },
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      reasoning: true,
      input: ["text"],
      contextWindow: 1000000,
      maxTokens: 384000,
      // 文档标注高峰/低谷价：Off-Peak 为 $0.66/$1.98/$0.022；Peak（01:00-04:00 与 06:00-10:00 UTC）为 $1.32/$3.96/$0.044。
      cost: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0 },
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      reasoning: true,
      input: ["text"],
      contextWindow: 1000000,
      maxTokens: 384000,
      // Off-Peak 价；Peak 时段为 $0.44/$1.32/$0.014。
      cost: { input: 0.22, output: 0.66, cacheRead: 0.007, cacheWrite: 0 },
    },
    {
      id: "mimo-v2.5",
      name: "MiMo V2.5",
      reasoning: true,
      input: ["text"],
      cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    },
    {
      id: "mimo-v2.5-pro",
      name: "MiMo V2.5 Pro",
      reasoning: true,
      input: ["text"],
      cost: { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
    },
    {
      id: "hy3",
      name: "Hy3",
      reasoning: true,
      input: ["text"],
      cost: { input: 0.14, output: 0.58, cacheRead: 0.035, cacheWrite: 0 },
    },
    {
      id: "gpt-5.6-luna",
      name: "GPT 5.6 Luna",
      reasoning: true,
      input: ["text"],
      api: "openai-responses",
      contextWindow: 272000,
      cost: {
        input: 0.2,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
        tiers: [
          {
            inputTokensAbove: 272000,
            input: 0.4,
            output: 1.8,
            cacheRead: 0.04,
            cacheWrite: 0.5,
          },
        ],
      },
    },
    {
      id: "minimax-m3",
      name: "MiniMax M3",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
    },
    {
      id: "minimax-m2.7",
      name: "MiniMax M2.7",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
    },
    {
      id: "minimax-m2.5",
      name: "MiniMax M2.5",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
    },
    {
      id: "muse-spark-1.2-contributor",
      name: "Muse Spark 1.2 Contributor",
      reasoning: true,
      input: ["text"],
      api: "openai-responses",
      cost: { input: 0.1, output: 0.2, cacheRead: 0.002, cacheWrite: 0 },
    },
    {
      id: "qwen3.8-max",
      name: "Qwen3.8 Max",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: { input: 2, output: 6, cacheRead: 0.25, cacheWrite: 2.5 },
    },
    {
      id: "qwen3.7-max",
      name: "Qwen3.7 Max",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: { input: 2.5, output: 7.5, cacheRead: 0.5, cacheWrite: 3.125 },
    },
    {
      id: "qwen3.7-plus",
      name: "Qwen3.7 Plus",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: {
        input: 0.4,
        output: 1.6,
        cacheRead: 0.04,
        cacheWrite: 0.5,
        tiers: [
          {
            inputTokensAbove: 256000,
            input: 1.2,
            output: 4.8,
            cacheRead: 0.12,
            cacheWrite: 1.5,
          },
        ],
      },
    },
    {
      id: "qwen3.6-plus",
      name: "Qwen3.6 Plus",
      reasoning: true,
      input: ["text"],
      api: "anthropic-messages",
      cost: {
        input: 0.5,
        output: 3,
        cacheRead: 0.05,
        cacheWrite: 0.625,
        tiers: [
          {
            inputTokensAbove: 256000,
            input: 2,
            output: 6,
            cacheRead: 0.2,
            cacheWrite: 2.5,
          },
        ],
      },
    },
  ],
};

interface PriceRow {
  base: string;
  annotation: string;
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number | null;
}

/** Strips tags and unescapes the entities Astro emits inside a table cell. */
function cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableCells(html: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
  for (const match of html.matchAll(rowPattern)) {
    const cells: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g;
    for (const cell of match[1].matchAll(cellPattern)) cells.push(cellText(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** "MiMo-V2.5" and "MiMo V2.5" must land in the same bucket, so only letters/digits count. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePrice(cell: string): number | null {
  const match = /^\$([\d.,]+)/.exec(cell);
  if (!match) return null;
  const value = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(value) ? value : null;
}

function splitAnnotation(name: string): { base: string; annotation: string } {
  const match = /\s*[（(]([^）)]*)[）)]\s*$/.exec(name);
  if (!match) return { base: name, annotation: "" };
  return { base: name.slice(0, match.index).trim(), annotation: match[1] };
}

function tierThreshold(annotation: string): number | null {
  const number = /\d+(?:\.\d+)?/.exec(annotation)?.[0];
  if (!number) return null;
  return /k/i.test(annotation) ? Math.round(Number(number) * 1000) : Number(number);
}

function apiFromEndpoint(
  endpoint: string,
): "openai-completions" | "openai-responses" | "anthropic-messages" {
  if (endpoint.endsWith("/responses")) return "openai-responses";
  if (endpoint.endsWith("/messages")) return "anthropic-messages";
  return "openai-completions";
}

function costObject(rows: PriceRow[]): Record<string, unknown> | null {
  if (rows.length === 0) return null;

  let primary = rows[0];
  const tiers: PriceRow[] = [];
  for (const row of rows) {
    // "> N tokens" rows describe the upper band of a token-tiered price.
    if (row.annotation.startsWith(">") || row.annotation.startsWith("＞")) {
      if (tierThreshold(row.annotation) !== null) tiers.push(row);
      continue;
    }
    // Off-peak is the everyday DeepSeek rate; "Peak" stays out of the preset.
    if (/^off/i.test(row.annotation)) primary = row;
    else if (primary.annotation.startsWith(">")) primary = row;
  }
  // "≤ N tokens" is the default tier for token-banded models, so prefer it over a plain row.
  const within = rows.find((row) => /≤/.test(row.annotation) || /＜=/.test(row.annotation));
  if (within) primary = within;

  const base = {
    input: primary.input,
    output: primary.output,
    cacheRead: primary.cacheRead ?? 0,
    cacheWrite: primary.cacheWrite ?? 0,
  };

  const bands = tiers
    .map((row) => ({ row, threshold: tierThreshold(row.annotation) ?? 0 }))
    .sort((a, b) => a.threshold - b.threshold)
    .map(({ row, threshold }) => ({
      inputTokensAbove: threshold,
      input: row.input,
      output: row.output,
      cacheRead: row.cacheRead ?? 0,
      cacheWrite: row.cacheWrite ?? 0,
    }));

  return bands.length ? { ...base, tiers: bands } : base;
}

/**
 * Parses the two data tables straight out of the docs HTML. Only a model-catalog row
 * (a 4+ cell row whose second cell is a model ID and third is a /zen/go/v1 URL) and a
 * price row (a 5+ cell row whose second and third cells are dollar amounts) are used,
 * so the parse survives markup changes.
 */
export function parseOpenCodeGoModels(html: string): ModelConfiguration[] {
  const catalog: Array<{ id: string; name: string; api: ModelConfiguration["api"] }> = [];
  const prices = new Map<string, PriceRow[]>();
  const baselineById = new Map(openCodeGoPreset.models.map((model) => [model.id, model] as const));

  for (const cells of tableCells(html)) {
    if (
      cells.length >= 4 &&
      /^[a-z0-9][a-z0-9._/-]*$/.test(cells[1]) &&
      cells[2].includes("/zen/go/v1/")
    ) {
      catalog.push({ id: cells[1], name: cells[0], api: apiFromEndpoint(cells[2]) });
      continue;
    }
    if (cells.length >= 5 && parsePrice(cells[1]) !== null && parsePrice(cells[2]) !== null) {
      const { base, annotation } = splitAnnotation(cells[0]);
      const key = normalizeName(base);
      const rows = prices.get(key) ?? [];
      rows.push({
        base,
        annotation,
        input: parsePrice(cells[1]) ?? 0,
        output: parsePrice(cells[2]) ?? 0,
        cacheRead: cells[3] === "-" || cells[3] === "—" ? null : parsePrice(cells[3]),
        cacheWrite: cells[4] === "-" || cells[4] === "—" ? null : parsePrice(cells[4]),
      });
      prices.set(key, rows);
      continue;
    }
  }

  if (catalog.length === 0)
    throw new Error("未能从 OpenCode 文档解析出模型目录，页面结构可能已改版");

  return catalog.map((entry) => {
    const model: ModelConfiguration = {
      id: entry.id,
      name: entry.name,
      reasoning: true,
      input: ["text"],
    };
    // `openai-completions` is the provider default; only a non-default shape needs the field.
    if (entry.api !== "openai-completions") model.api = entry.api;
    const cost = costObject(prices.get(normalizeName(entry.name)) ?? []);
    if (cost) model.cost = cost;

    // The docs publish no context/output caps; carry them over from the shipped snapshot
    // for models we already knew about.
    const baseline = baselineById.get(entry.id);
    if (baseline?.contextWindow) model.contextWindow = baseline.contextWindow;
    if (baseline?.maxTokens) model.maxTokens = baseline.maxTokens;
    return model;
  });
}

/**
 * Fetches the live docs and rebuilds the `opencode-go` preset. Connection details and the
 * description come from the shipped snapshot; models and prices come from the docs.
 */
export async function refreshOpenCodeGoPreset(
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderPreset> {
  const response = await fetchImpl(openCodeGoDocsUrl, { headers: { accept: "text/html" } });
  if (!response.ok) throw new Error(`无法获取 OpenCode 文档（HTTP ${response.status}）`);

  const baseline = openCodeGoPreset;
  return {
    id: "opencode-go",
    label: baseline.label,
    description: baseline.description,
    docsUrl: openCodeGoDocsUrl,
    provider: baseline.provider,
    models: parseOpenCodeGoModels(await response.text()),
  };
}
