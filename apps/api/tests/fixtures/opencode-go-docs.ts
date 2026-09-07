/**
 * A trimmed copy of the OpenCode Go docs HTML structure (zh-CN). Markup has been simplified
 * but keeps the shapes that matter: rows are `<tr>` with `<th>/<td>` cells, model names may
 * be wrapped in links, and prices are `$1.40`-style strings with `-` for missing cache tiers.
 * Shared by the parser tests and the preset-registry refresh tests.
 */
export const openCodeGoDocsHtml = `<!doctype html><html lang="zh-CN"><body>
<h2>API 端点</h2>
<table>
  <thead><tr><th>模型</th><th>模型 ID</th><th>端点</th><th>AI SDK 包</th></tr></thead>
  <tbody>
    <tr><td><a href="/docs/zh-cn/go/#grok">Grok 4.5</a></td><td>grok-4.5</td><td>https://opencode.ai/zen/go/v1/responses</td><td>@ai-sdk/openai</td></tr>
    <tr><td>GPT 5.6 Luna</td><td>gpt-5.6-luna</td><td>https://opencode.ai/zen/go/v1/responses</td><td>@ai-sdk/openai</td></tr>
    <tr><td>GLM-5.3</td><td>glm-5.3</td><td>https://opencode.ai/zen/go/v1/chat/completions</td><td>@ai-sdk/openai-compatible</td></tr>
    <tr><td>MiMo-V2.5</td><td>mimo-v2.5</td><td>https://opencode.ai/zen/go/v1/chat/completions</td><td>@ai-sdk/openai-compatible</td></tr>
    <tr><td>MiniMax M3</td><td>minimax-m3</td><td>https://opencode.ai/zen/go/v1/messages</td><td>@ai-sdk/anthropic</td></tr>
    <tr><td>DeepSeek V4 Pro</td><td>deepseek-v4-pro</td><td>https://opencode.ai/zen/go/v1/chat/completions</td><td>@ai-sdk/openai-compatible</td></tr>
    <tr><td>Qwen3.7 Plus</td><td>qwen3.7-plus</td><td>https://opencode.ai/zen/go/v1/messages</td><td>@ai-sdk/anthropic</td></tr>
    <tr><td>Hy3</td><td>hy3</td><td>https://opencode.ai/zen/go/v1/chat/completions</td><td>@ai-sdk/openai-compatible</td></tr>
  </tbody>
</table>

<h2>价格</h2>
<table>
  <thead><tr><th>模型</th><th>输入</th><th>输出</th><th>缓存读取</th><th>缓存写入</th><th>使用额度</th></tr></thead>
  <tbody>
    <tr><td>Grok 4.5</td><td>$2.00</td><td>$6.00</td><td>$0.30</td><td>-</td><td>$15</td></tr>
    <tr><td>GPT 5.6 Luna (≤ 272K tokens)</td><td>$0.20</td><td>$1.20</td><td>$0.02</td><td>$0.25</td><td>$15</td></tr>
    <tr><td>GPT 5.6 Luna (&gt; 272K tokens)</td><td>$0.40</td><td>$1.80</td><td>$0.04</td><td>$0.50</td><td>$15</td></tr>
    <tr><td>GLM-5.3</td><td>$1.40</td><td>$4.40</td><td>$0.26</td><td>-</td><td>$15</td></tr>
    <tr><td>MiMo V2.5</td><td>$0.14</td><td>$0.28</td><td>$0.0028</td><td>-</td><td>$60</td></tr>
    <tr><td>MiniMax M3</td><td>$0.30</td><td>$1.20</td><td>$0.06</td><td>-</td><td>$60</td></tr>
    <tr><td>DeepSeek V4 Pro (Off-Peak)</td><td>$0.66</td><td>$1.98</td><td>$0.022</td><td>-</td><td>$15</td></tr>
    <tr><td>DeepSeek V4 Pro (Peak)</td><td>$1.32</td><td>$3.96</td><td>$0.044</td><td>-</td><td>$15</td></tr>
    <tr><td>Qwen3.7 Plus (≤ 256K tokens)</td><td>$0.40</td><td>$1.60</td><td>$0.04</td><td>$0.50</td><td>$60</td></tr>
    <tr><td>Qwen3.7 Plus (&gt; 256K tokens)</td><td>$1.20</td><td>$4.80</td><td>$0.12</td><td>$1.50</td><td>$60</td></tr>
    <tr><td>Hy3</td><td>$0.14</td><td>$0.58</td><td>$0.035</td><td>-</td><td>$60</td></tr>
  </tbody>
</table>
</body></html>`;
