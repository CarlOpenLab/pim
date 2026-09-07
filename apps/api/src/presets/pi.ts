/**
 * Provider templates for Pi's `models.json`. These are starting points: connection fields
 * (base URL, API shape, key variable) are the durable part, while model IDs and prices move
 * whenever a vendor ships. Presets never carry a literal key — only a `$VAR_NAME` reference.
 *
 * Costs are US dollars per million tokens. Anthropic cache rates follow the published
 * multipliers: reads at 0.1x input, 5-minute writes at 1.25x input.
 */
import { commandCodeGoatPreset } from "./command-code-goat.js";
import { openCodeGoPreset } from "./opencode-go.js";
import type { ProviderPreset } from "./types.js";

export const piModelPresets: ProviderPreset[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude 官方 API，Messages 接口。",
    docsUrl: "https://platform.claude.com/docs/en/about-claude/models/overview",
    provider: {
      baseUrl: "https://api.anthropic.com/v1",
      api: "anthropic-messages",
      apiKey: "$ANTHROPIC_API_KEY",
    },
    models: [
      {
        id: "claude-opus-5",
        name: "Claude Opus 5",
        contextWindow: 1000000,
        maxTokens: 128000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      },
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        contextWindow: 1000000,
        maxTokens: 128000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        contextWindow: 200000,
        maxTokens: 64000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
      },
      {
        id: "claude-fable-5",
        name: "Claude Fable 5",
        contextWindow: 1000000,
        maxTokens: 128000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
      },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek 官方 API，OpenAI Chat Completions 兼容。",
    docsUrl: "https://api-docs.deepseek.com",
    provider: {
      baseUrl: "https://api.deepseek.com",
      api: "openai-completions",
      apiKey: "$DEEPSEEK_API_KEY",
    },
    models: [
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        contextWindow: 1000000,
        maxTokens: 384000,
        input: ["text"],
        reasoning: true,
        cost: { input: 1.74, output: 3.48, cacheRead: 0.145, cacheWrite: 0 },
        compat: {
          requiresReasoningContentOnAssistantMessages: true,
          thinkingFormat: "deepseek",
          reasoningEffortMap: {
            minimal: "high",
            low: "high",
            medium: "high",
            high: "high",
            xhigh: "max",
          },
        },
      },
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        contextWindow: 1000000,
        maxTokens: 384000,
        input: ["text"],
        reasoning: true,
        cost: { input: 0.14, output: 0.28, cacheRead: 0.028, cacheWrite: 0 },
        compat: {
          requiresReasoningContentOnAssistantMessages: true,
          thinkingFormat: "deepseek",
          reasoningEffortMap: {
            minimal: "high",
            low: "high",
            medium: "high",
            high: "high",
            xhigh: "max",
          },
        },
      },
    ],
  },
  {
    id: "ark",
    label: "火山方舟 Coding",
    description: "字节火山引擎方舟的 Coding 端点，聚合豆包与多家第三方模型。",
    docsUrl: "https://www.volcengine.com/docs/82379",
    provider: {
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
      api: "openai-responses",
      apiKey: "$ARK_API_KEY",
    },
    models: [
      {
        id: "doubao-seed-2.0-code",
        name: "Doubao Seed 2.0 Code",
        contextWindow: 256000,
        input: ["text"],
        reasoning: true,
      },
      {
        id: "doubao-seed-2.0-pro",
        name: "Doubao Seed 2.0 Pro",
        contextWindow: 256000,
        input: ["text"],
        reasoning: true,
      },
      { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", input: ["text"], reasoning: true },
      { id: "glm-latest", name: "GLM Latest", input: ["text"], reasoning: true },
    ],
  },
  openCodeGoPreset,
  commandCodeGoatPreset,
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API，Responses 接口。模型目录请按账号可用范围自行添加。",
    docsUrl: "https://platform.openai.com/docs/models",
    provider: {
      baseUrl: "https://api.openai.com/v1",
      api: "openai-responses",
      apiKey: "$OPENAI_API_KEY",
    },
    models: [],
  },
  {
    id: "google",
    label: "Google Gemini",
    description: "Google Generative AI 接口。模型目录请按账号可用范围自行添加。",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    provider: {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      api: "google-generative-ai",
      apiKey: "$GEMINI_API_KEY",
    },
    models: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter 聚合网关，模型 ID 形如 vendor/model。",
    docsUrl: "https://openrouter.ai/docs",
    provider: {
      baseUrl: "https://openrouter.ai/api/v1",
      api: "openai-completions",
      apiKey: "$OPENROUTER_API_KEY",
    },
    models: [],
  },
  {
    id: "ollama",
    label: "Ollama（本地）",
    description: "本地 Ollama 服务，不需要密钥；模型 ID 用 ollama list 里的 tag。",
    docsUrl: "https://github.com/ollama/ollama/blob/main/docs/openai.md",
    provider: {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
    },
    models: [],
  },
];
