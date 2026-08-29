/**
 * Provider templates for OMP's `models.json`.
 * Presets are starting points — connection fields are durable while model IDs/prices drift.
 * Never carry a literal key, only `$VAR_NAME`.
 */
import type { ProviderPreset, RolePreset } from "../adapters/types.js";

export const ompModelPresets: ProviderPreset[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude 官方 API，Messages 接口 — OMP 原生支持。",
    docsUrl: "https://platform.claude.com/docs/en/about-claude/models/overview",
    provider: {
      baseUrl: "https://api.anthropic.com/v1",
      api: "anthropic-messages",
      apiKey: "$ANTHROPIC_API_KEY",
    },
    models: [
      {
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
        contextWindow: 200000,
        maxTokens: 8192,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      },
      {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        contextWindow: 200000,
        maxTokens: 8192,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      },
    ],
  },
  {
    id: "openai-omp",
    label: "OpenAI (OMP)",
    description: "OpenAI Responses 接口，OMP 推荐配置，已适配推理与工具调用。",
    docsUrl: "https://platform.openai.com/docs/models",
    provider: {
      baseUrl: "https://api.openai.com/v1",
      api: "openai-responses",
      apiKey: "$OPENAI_API_KEY",
    },
    models: [
      {
        id: "gpt-5",
        name: "GPT-5",
        contextWindow: 400000,
        maxTokens: 128000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 2.5, output: 10, cacheRead: 0.25, cacheWrite: 1.25 },
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        contextWindow: 400000,
        maxTokens: 128000,
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 0.5, output: 2, cacheRead: 0.05, cacheWrite: 0.25 },
      },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek 官方 API，OpenAI 兼容，OMP 中常用作低成本主力。",
    docsUrl: "https://api-docs.deepseek.com",
    provider: {
      baseUrl: "https://api.deepseek.com",
      api: "openai-completions",
      apiKey: "$DEEPSEEK_API_KEY",
    },
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        contextWindow: 128000,
        maxTokens: 8192,
        input: ["text"],
        reasoning: true,
        cost: { input: 0.27, output: 1.1, cacheRead: 0.027, cacheWrite: 0 },
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek Reasoner",
        contextWindow: 128000,
        maxTokens: 8192,
        input: ["text"],
        reasoning: true,
        cost: { input: 0.55, output: 2.19, cacheRead: 0.055, cacheWrite: 0 },
      },
    ],
  },
  {
    id: "ollama",
    label: "Ollama（本地）",
    description: "本地 Ollama，不需要密钥；OMP 本地角色调试首选。",
    docsUrl: "https://github.com/ollama/ollama/blob/main/docs/openai.md",
    provider: {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
    },
    models: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter 聚合网关，OMP 可用 vendor/model 直通。",
    docsUrl: "https://openrouter.ai/docs",
    provider: {
      baseUrl: "https://openrouter.ai/api/v1",
      api: "openai-completions",
      apiKey: "$OPENROUTER_API_KEY",
    },
    models: [],
  },
];

/** OMP 内置角色预设 — 与 settings.json 的 `roles` / `activeRole` 联动 */
export type OmpRolePreset = RolePreset;

export const ompRolePresets: RolePreset[] = [
  {
    id: "coder",
    label: "全栈工程师",
    description: "专注工程实现，偏好简洁可维护的代码与测试。",
    prompt: "You are a senior full-stack engineer. Prioritize clean, tested, minimal code.",
    icon: "💻",
    accent: "#1677ff",
  },
  {
    id: "architect",
    label: "系统架构师",
    description: "关注分层、边界与演进路线，输出架构权衡与图示。",
    prompt: "You are a pragmatic system architect. Explain trade-offs and draw boundaries.",
    icon: "🏗️",
    accent: "#722ed1",
  },
  {
    id: "reviewer",
    label: "代码评审官",
    description: "挑剔但建设性，聚焦可读性、安全性与潜在坑。",
    prompt: "You are a strict but helpful code reviewer. Be specific and suggest fixes.",
    icon: "🔍",
    accent: "#fa541c",
  },
  {
    id: "writer",
    label: "技术写作",
    description: "用中文清晰解释技术概念，适合写文档与 RFC。",
    prompt: "You are a technical writer. Explain clearly in Chinese with examples.",
    icon: "✍️",
    accent: "#13c2c2",
  },
  {
    id: "assistant",
    label: "通用助手",
    description: "平衡效率与解释，适合日常问答与快速探索。",
    prompt: "You are a helpful AI assistant.",
    icon: "✨",
    accent: "#52c41a",
  },
  {
    id: "ops",
    label: "运维排障",
    description: "擅长日志、监控与故障推断，给出可执行排查步骤。",
    prompt: "You are an SRE / ops troubleshooter. Give concrete steps and commands.",
    icon: "🛠️",
    accent: "#faad14",
  },
];
