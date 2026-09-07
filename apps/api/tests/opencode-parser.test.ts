/// <reference types="vitest/globals" />
import { parseOpenCodeGoModels } from "../src/presets/opencode-go.ts";
import { openCodeGoDocsHtml } from "./fixtures/opencode-go-docs.ts";

const docsHtml = openCodeGoDocsHtml;

describe("parseOpenCodeGoModels", () => {
  test("extracts one model per catalog row with id, name and endpoint-derived api", () => {
    const models = parseOpenCodeGoModels(docsHtml);
    const byId = new Map(models.map((model) => [model.id, model]));

    expect(models).toHaveLength(8);
    expect(byId.get("grok-4.5")).toMatchObject({ name: "Grok 4.5", api: "openai-responses" });
    expect(byId.get("glm-5.3")?.api).toBeUndefined(); // chat completions is the default
    expect(byId.get("minimax-m3")).toMatchObject({ api: "anthropic-messages" });
    expect(byId.get("qwen3.7-plus")).toMatchObject({ api: "anthropic-messages" });
    expect(byId.get("hy3")?.api).toBeUndefined();
  });

  test("attaches flat prices and treats missing cache tiers as zero", () => {
    const byId = new Map(parseOpenCodeGoModels(docsHtml).map((model) => [model.id, model]));

    expect(byId.get("grok-4.5")?.cost).toEqual({
      input: 2,
      output: 6,
      cacheRead: 0.3,
      cacheWrite: 0,
    });
    expect(byId.get("glm-5.3")?.cost).toEqual({
      input: 1.4,
      output: 4.4,
      cacheRead: 0.26,
      cacheWrite: 0,
    });
  });

  test("bridges display-name differences such as MiMo-V2.5 vs MiMo V2.5", () => {
    const byId = new Map(parseOpenCodeGoModels(docsHtml).map((model) => [model.id, model]));

    expect(byId.get("mimo-v2.5")?.cost).toEqual({
      input: 0.14,
      output: 0.28,
      cacheRead: 0.0028,
      cacheWrite: 0,
    });
  });

  test("builds token tiers from ≤/> price bands", () => {
    const byId = new Map(parseOpenCodeGoModels(docsHtml).map((model) => [model.id, model]));

    expect(byId.get("gpt-5.6-luna")?.cost).toEqual({
      input: 0.2,
      output: 1.2,
      cacheRead: 0.02,
      cacheWrite: 0.25,
      tiers: [
        { inputTokensAbove: 272000, input: 0.4, output: 1.8, cacheRead: 0.04, cacheWrite: 0.5 },
      ],
    });
    expect(byId.get("qwen3.7-plus")?.cost).toMatchObject({
      input: 0.4,
      output: 1.6,
      tiers: [{ inputTokensAbove: 256000, input: 1.2, output: 4.8 }],
    });
  });

  test("prefers the off-peak DeepSeek rate over the peak rate", () => {
    const byId = new Map(parseOpenCodeGoModels(docsHtml).map((model) => [model.id, model]));

    expect(byId.get("deepseek-v4-pro")?.cost).toEqual({
      input: 0.66,
      output: 1.98,
      cacheRead: 0.022,
      cacheWrite: 0,
    });
  });

  test("carries context window and max tokens over from the shipped snapshot", () => {
    const byId = new Map(parseOpenCodeGoModels(docsHtml).map((model) => [model.id, model]));

    // DeepSeek is in the baseline snapshot with context/caps, and shows up in the docs too.
    expect(byId.get("deepseek-v4-pro")).toMatchObject({
      contextWindow: 1000000,
      maxTokens: 384000,
    });
    // A brand-new model only carries what the docs provide.
    expect(byId.get("glm-5.3")?.contextWindow).toBeUndefined();
  });

  test("throws a clear error when the docs no longer expose a model table", () => {
    expect(() => parseOpenCodeGoModels("<html><body>maintenance</body></html>")).toThrow(
      /从 OpenCode 文档解析/,
    );
  });
});
