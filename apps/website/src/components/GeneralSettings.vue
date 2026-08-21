<script setup lang="ts">
import { computed } from "vue";
import { Monitor, Palette, Settings2, Zap } from "@lucide/vue";
import TerminalPreview from "./TerminalPreview.vue";
import type { ModelsConfiguration, OmpAvailableModel, OmpRolePreset } from "../types.ts";

const props = defineProps<{
  settings: Record<string, unknown>;
  agentId?: string;
  rolePresets?: OmpRolePreset[];
  models?: ModelsConfiguration;
  availableModels?: OmpAvailableModel[];
}>();

function field<T>(key: string, fallback: T) {
  return computed<T>({
    get: () => (props.settings[key] as T | undefined) ?? fallback,
    set: (value) => {
      props.settings[key] = value;
    },
  });
}

function nestedField<T>(group: string, key: string, fallback: T) {
  return computed<T>({
    get: () =>
      ((props.settings[group] as Record<string, unknown> | undefined)?.[key] as T | undefined) ??
      fallback,
    set: (value) => {
      props.settings[group] = {
        ...(props.settings[group] as Record<string, unknown> | undefined),
        [key]: value,
      };
    },
  });
}

const isOmp = computed(() => props.agentId === "omp");

const defaultProvider = field("defaultProvider", "");
const defaultModel = field("defaultModel", "");
const thinkingLevel = field("defaultThinkingLevel", "medium");
const enabledModels = field<string[]>("enabledModels", []);
const theme = field("theme", "dark");
const projectTrust = field("defaultProjectTrust", "ask");
const quietStartup = field("quietStartup", false);
const hideThinking = field("hideThinkingBlock", false);
const telemetry = field("enableInstallTelemetry", true);
const steeringMode = field("steeringMode", "one-at-a-time");
const followUpMode = field("followUpMode", "one-at-a-time");
const transport = field("transport", "auto");
const compactionEnabled = nestedField("compaction", "enabled", true);
const reserveTokens = nestedField("compaction", "reserveTokens", 16384);
const keepRecentTokens = nestedField("compaction", "keepRecentTokens", 20000);
const retryEnabled = nestedField("retry", "enabled", true);
const maxRetries = nestedField("retry", "maxRetries", 3);
const retryDelay = nestedField("retry", "baseDelayMs", 2000);

// —— 模型相关下拉的数据源：从 models.providers + availableModels 汇聚 —— //
const providerOptions = computed(() => {
  const ids = Object.keys(props.models?.providers ?? {}).sort();
  return ids.map((id) => ({ value: id, label: id }));
});

const allModelSelectors = computed(() => {
  const selectors = new Set<string>();
  for (const [provider, cfg] of Object.entries(props.models?.providers ?? {})) {
    for (const m of cfg.models ?? []) {
      if (m.id) selectors.add(`${provider}/${m.id}`);
    }
  }
  for (const m of props.availableModels ?? []) {
    if (m.selector) selectors.add(m.selector);
  }
  return [...selectors].sort();
});

const modelOptions = computed(() => {
  const provider = (defaultProvider.value as string) || "";
  const list = provider
    ? allModelSelectors.value.filter((s) => s.startsWith(`${provider}/`))
    : allModelSelectors.value;
  // 当按 provider 过滤后为空，回退到全量，避免下拉“看起来空的”
  const source = list.length ? list : allModelSelectors.value;
  return source.map((selector) => ({ value: selector, label: selector }));
});

const enabledModelOptions = computed(() => {
  const selectors = allModelSelectors.value;
  const providers = Object.keys(props.models?.providers ?? {}).sort();
  const wildcardOptions = providers.map((p) => ({ value: `${p}/*`, label: `${p}/*` }));
  const base = selectors.map((s) => ({ value: s, label: s }));
  // 额外提供 * 通配
  if (selectors.length || providers.length) {
    return [...base, ...wildcardOptions, { value: "*", label: "*" }];
  }
  return [];
});

// terminal 美化字段
const terminalTheme = nestedField<string>("terminal", "theme", "dark");
const fontFamily = nestedField("terminal", "fontFamily", "SFMono-Regular, Menlo, monospace");
const fontSize = nestedField("terminal", "fontSize", 13);
const lineHeight = nestedField("terminal", "lineHeight", 1.6);
const opacity = nestedField("terminal", "opacity", 0.96);
const blur = nestedField("terminal", "blur", true);
const cursorStyle = nestedField("terminal", "cursorStyle", "block");
const cursorBlink = nestedField("terminal", "cursorBlink", true);
const accent = nestedField("terminal", "accent", "#722ed1");
const background = nestedField("terminal", "background", "");

const terminalConfig = computed(() => ({
  theme: (terminalTheme.value as any) ?? "dark",
  fontFamily: fontFamily.value,
  fontSize: fontSize.value,
  lineHeight: lineHeight.value,
  opacity: opacity.value,
  blur: blur.value,
  cursorStyle: cursorStyle.value as any,
  cursorBlink: cursorBlink.value,
  background: background.value || undefined,
  accent: accent.value,
}));

const fontOptions = [
  "SFMono-Regular, Menlo, monospace",
  "JetBrains Mono, monospace",
  "Cascadia Code, monospace",
  "Fira Code, monospace",
  "Geist Mono, monospace",
  "Hack, monospace",
  "IBM Plex Mono, monospace",
  "Source Code Pro, monospace",
  "Consolas, monospace",
  "Operator Mono, monospace",
  "Dank Mono, monospace",
  "Monolisa, monospace",
];
const fontFamilyOptions = computed(() => {
  const base = fontOptions.map((f) => ({ value: f, label: f.split(",")[0] }));
  // 当前值不在预设中时，仍展示为可选项，避免“空的”或“被截断”观感
  if (fontFamily.value && !fontOptions.includes(fontFamily.value as string)) {
    const cur = String(fontFamily.value);
    return [{ value: cur, label: `${cur.split(",")[0]}（自定义）` }, ...base];
  }
  return base;
});
</script>
<template>
  <a-form layout="vertical" class="panel-stack">
    <a-card v-if="!isOmp" :bordered="false" class="panel-card">
      <template #title>
        <span class="card-title"><Zap :size="16" />模型与推理</span>
      </template>
      <a-row :gutter="[20, 0]">
        <a-col :xs="24" :md="12"
          ><a-form-item
            label="默认 Provider"
            :extra="
              providerOptions.length
                ? '从已配置的 Provider 中选择'
                : '暂无 Provider，去「模型服务」先添加'
            "
            ><a-select
              v-model:value="defaultProvider"
              placeholder="选择 Provider"
              show-search
              allow-clear
              :options="providerOptions"
              :not-found-content="providerOptions.length ? undefined : '暂无 Provider'"
              :filter-option="
                (input: string, option: any) =>
                  String(option.value).toLowerCase().includes(input.toLowerCase())
              " /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item
            label="默认模型"
            :extra="
              modelOptions.length
                ? '格式 provider/model，可按已选 Provider 过滤'
                : '先在「模型服务」添加模型'
            "
            ><a-select
              v-model:value="defaultModel"
              placeholder="选择模型，如 anthropic/claude-sonnet-4-5"
              show-search
              allow-clear
              :options="modelOptions"
              :not-found-content="modelOptions.length ? undefined : '暂无模型'"
              :filter-option="
                (input: string, option: any) =>
                  String(option.value).toLowerCase().includes(input.toLowerCase()) ||
                  String(option.label).toLowerCase().includes(input.toLowerCase())
              " /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item label="默认推理级别" extra="Pi 思考深度，影响未显式指定 thinking 的请求">
            <a-select
              v-model:value="thinkingLevel"
              placeholder="选择推理级别"
              :options="
                ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map((level) => ({
                  value: level,
                  label: level,
                }))
              "
              :filter-option="
                (input: string, option: any) =>
                  String(option.value).toLowerCase().includes(input.toLowerCase())
              "
              show-search
              :not-found-content="'无匹配'"
            /> </a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item
            label="模型轮换范围"
            extra="用于 Ctrl+P 轮换的匹配模式，可选具体模型或通配如 anthropic/*"
            ><a-select
              v-model:value="enabledModels"
              mode="tags"
              placeholder="选择或输入模型匹配模式"
              :options="enabledModelOptions"
              :not-found-content="
                enabledModelOptions.length ? undefined : '暂无可选模型，先去添加 Provider/模型'
              "
              :filter-option="
                (input: string, option: any) =>
                  String(option.value).toLowerCase().includes(input.toLowerCase())
              " /></a-form-item
        ></a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" class="panel-card terminal-card">
      <template #title>
        <span class="card-title"><Monitor :size="16" />终端体验</span>
        <span v-if="isOmp" class="card-subtitle">OMP 专属 · 实时预览</span>
      </template>
      <a-row :gutter="[20, 0]">
        <a-col :xs="24" :md="8"
          ><a-form-item label="终端主题"
            ><a-select
              v-model:value="theme"
              placeholder="选择主题"
              :options="[
                { value: 'dark', label: 'dark' },
                { value: 'light', label: 'light' },
              ]" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="8"
          ><a-form-item label="项目默认信任"
            ><a-select
              v-model:value="projectTrust"
              placeholder="选择信任策略"
              :options="[
                { value: 'ask', label: '每次询问' },
                { value: 'always', label: '始终信任' },
                { value: 'never', label: '从不信任' },
              ]" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="8"
          ><a-form-item label="传输方式"
            ><a-select
              v-model:value="transport"
              placeholder="选择传输"
              :options="[
                { value: 'auto', label: '自动选择' },
                { value: 'sse', label: 'SSE' },
                { value: 'websocket', label: 'WebSocket' },
                { value: 'websocket-cached', label: 'WebSocket Cached' },
              ]" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item label="Steering 消息"
            ><a-select
              v-model:value="steeringMode"
              placeholder="选择发送策略"
              :options="[
                { value: 'one-at-a-time', label: '逐条发送' },
                { value: 'all', label: '一次发送全部' },
              ]" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item label="Follow-up 消息"
            ><a-select
              v-model:value="followUpMode"
              placeholder="选择发送策略"
              :options="[
                { value: 'one-at-a-time', label: '逐条发送' },
                { value: 'all', label: '一次发送全部' },
              ]" /></a-form-item
        ></a-col>
      </a-row>

      <!-- 终端美化进阶 -->
      <div class="terminal-tune">
        <div class="tune-head">
          <Palette :size="14" /> 外观微调
          <a-typography-text type="secondary"
            >所见即所得，保存后写入 settings.json → terminal</a-typography-text
          >
        </div>
        <a-row :gutter="[16, 8]">
          <a-col :xs="12" :md="6"
            ><a-form-item label="窗口主题" extra="OMP 终端窗口 chrome 主题">
              <a-select
                v-model:value="terminalTheme"
                placeholder="选择窗口主题"
                :options="[
                  { value: 'dark', label: '深色' },
                  { value: 'light', label: '浅色' },
                  { value: 'auto', label: '跟随系统' },
                ]"
                :filter-option="
                  (input: string, option: any) =>
                    String(option.label).toLowerCase().includes(input.toLowerCase()) ||
                    String(option.value).toLowerCase().includes(input.toLowerCase())
                "
                show-search
              /> </a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="强调色"
              ><a-input v-model:value="accent" type="color" class="color-input" /></a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="字体" extra="可搜索；不在列表可直接粘贴 font-family">
              <a-select
                v-model:value="fontFamily"
                placeholder="选择或输入字体"
                show-search
                allow-clear
                :options="fontFamilyOptions"
                :filter-option="
                  (input: string, option: any) =>
                    String(option.value).toLowerCase().includes(input.toLowerCase()) ||
                    String(option.label).toLowerCase().includes(input.toLowerCase())
                "
                :not-found-content="'无匹配，可在高级 JSON 自定义 fontFamily'"
              /> </a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="字号"
              ><a-input-number
                v-model:value="fontSize"
                :min="10"
                :max="20"
                addon-after="px" /></a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="行高"
              ><a-input-number
                v-model:value="lineHeight"
                :min="1"
                :max="2"
                :step="0.1" /></a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="不透明度"
              ><a-input-number
                v-model:value="opacity"
                :min="0.5"
                :max="1"
                :step="0.02" /></a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="光标样式">
              <a-select
                v-model:value="cursorStyle"
                placeholder="选择光标"
                :options="[
                  { value: 'block', label: '方块' },
                  { value: 'bar', label: '竖线' },
                  { value: 'underline', label: '下划线' },
                ]"
              /> </a-form-item
          ></a-col>
          <a-col :xs="12" :md="6"
            ><a-form-item label="背景" extra="留空跟随主题，支持 #RRGGBB / rgba">
              <a-input v-model:value="background" placeholder="留空自动" /> </a-form-item
          ></a-col>
        </a-row>
        <div class="tune-switches">
          <span>毛玻璃 <a-switch v-model:checked="blur" size="small" /></span>
          <span>光标闪烁 <a-switch v-model:checked="cursorBlink" size="small" /></span>
        </div>
        <TerminalPreview :config="terminalConfig as any" />
      </div>

      <div class="setting-list">
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>安静启动</a-typography-text
            ><a-typography-text type="secondary">隐藏启动头部信息</a-typography-text>
          </div>
          <a-switch v-model:checked="quietStartup" />
        </div>
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>隐藏思考块</a-typography-text
            ><a-typography-text type="secondary">默认折叠模型的 thinking 输出</a-typography-text>
          </div>
          <a-switch v-model:checked="hideThinking" />
        </div>
      </div>
    </a-card>

    <a-card :bordered="false" class="panel-card">
      <template #title>
        <span class="card-title"><Settings2 :size="16" />会话与隐私</span>
      </template>
      <div class="setting-list">
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>上下文压缩</a-typography-text
            ><a-typography-text type="secondary">接近上下文上限时自动压缩</a-typography-text>
          </div>
          <a-space :size="12"
            ><a-input-number
              v-model:value="reserveTokens"
              :min="0"
              :step="1024"
              :disabled="!compactionEnabled"
              addon-before="响应保留"
              class="inline-number" /><a-input-number
              v-model:value="keepRecentTokens"
              :min="0"
              :step="1024"
              :disabled="!compactionEnabled"
              addon-before="近期保留"
              class="inline-number" /><a-switch v-model:checked="compactionEnabled"
          /></a-space>
        </div>
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>失败重试</a-typography-text
            ><a-typography-text type="secondary">只处理临时性错误</a-typography-text>
          </div>
          <a-space :size="12"
            ><a-input-number
              v-model:value="maxRetries"
              :min="0"
              :max="20"
              :disabled="!retryEnabled"
              addon-before="次数"
              class="inline-number" /><a-input-number
              v-model:value="retryDelay"
              :min="0"
              :step="500"
              :disabled="!retryEnabled"
              addon-before="延迟 ms"
              class="inline-number" /><a-switch v-model:checked="retryEnabled"
          /></a-space>
        </div>
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>安装与更新遥测</a-typography-text
            ><a-typography-text type="secondary"
              >发送匿名版本信息；不影响版本检查</a-typography-text
            >
          </div>
          <a-switch v-model:checked="telemetry" />
        </div>
      </div>
    </a-card>
  </a-form>
</template>
