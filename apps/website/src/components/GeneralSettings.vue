<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ settings: Record<string, unknown> }>();

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
</script>

<template>
  <a-form layout="vertical" class="settings-form">
    <a-card :bordered="false" class="settings-card">
      <template #title><span>模型与推理</span></template>
      <template #extra
        ><a-typography-text type="secondary">启动与模型选择</a-typography-text></template
      >
      <a-row :gutter="[20, 4]">
        <a-col :xs="24" :md="12"
          ><a-form-item label="默认 Provider"
            ><a-input v-model:value="defaultProvider" placeholder="例如 anthropic" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item label="默认模型"
            ><a-input
              v-model:value="defaultModel"
              placeholder="例如 claude-sonnet-4-5" /></a-form-item
        ></a-col>
        <a-col :xs="24" :md="12"
          ><a-form-item label="默认推理级别"
            ><a-select v-model:value="thinkingLevel"
              ><a-select-option
                v-for="level in ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']"
                :key="level"
                :value="level"
                >{{ level }}</a-select-option
              ></a-select
            ></a-form-item
          ></a-col
        >
        <a-col :xs="24" :md="12"
          ><a-form-item label="模型轮换范围" extra="用于 Ctrl+P 轮换的匹配模式"
            ><a-select
              v-model:value="enabledModels"
              mode="tags"
              placeholder="输入模型匹配模式" /></a-form-item
        ></a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" class="settings-card">
      <template #title><span>界面与消息</span></template>
      <template #extra
        ><a-typography-text type="secondary">终端体验与队列行为</a-typography-text></template
      >
      <a-row :gutter="[20, 4]">
        <a-col :xs="24" :md="12"
          ><a-form-item label="终端主题"
            ><a-select v-model:value="theme"
              ><a-select-option value="dark">dark</a-select-option
              ><a-select-option value="light">light</a-select-option></a-select
            ></a-form-item
          ></a-col
        >
        <a-col :xs="24" :md="12"
          ><a-form-item label="项目默认信任"
            ><a-select v-model:value="projectTrust"
              ><a-select-option value="ask">每次询问</a-select-option
              ><a-select-option value="always">始终信任</a-select-option
              ><a-select-option value="never">从不信任</a-select-option></a-select
            ></a-form-item
          ></a-col
        >
        <a-col :xs="24" :md="12"
          ><a-form-item label="Steering 消息"
            ><a-select v-model:value="steeringMode"
              ><a-select-option value="one-at-a-time">逐条发送</a-select-option
              ><a-select-option value="all">一次发送全部</a-select-option></a-select
            ></a-form-item
          ></a-col
        >
        <a-col :xs="24" :md="12"
          ><a-form-item label="Follow-up 消息"
            ><a-select v-model:value="followUpMode"
              ><a-select-option value="one-at-a-time">逐条发送</a-select-option
              ><a-select-option value="all">一次发送全部</a-select-option></a-select
            ></a-form-item
          ></a-col
        >
        <a-col :xs="24" :md="12"
          ><a-form-item label="传输方式"
            ><a-select v-model:value="transport"
              ><a-select-option value="auto">自动选择</a-select-option
              ><a-select-option value="sse">SSE</a-select-option
              ><a-select-option value="websocket">WebSocket</a-select-option
              ><a-select-option value="websocket-cached"
                >WebSocket Cached</a-select-option
              ></a-select
            ></a-form-item
          ></a-col
        >
      </a-row>
      <a-divider />
      <div class="setting-list">
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>安静启动</a-typography-text
            ><a-typography-text type="secondary">隐藏 Pi 启动头部信息</a-typography-text>
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

    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="settings-card compact-card">
          <template #title>上下文压缩</template>
          <template #extra><a-switch v-model:checked="compactionEnabled" /></template>
          <a-typography-text type="secondary" class="card-help"
            >长会话接近上下文上限时自动压缩。</a-typography-text
          >
          <a-form-item label="响应保留 Token"
            ><a-input-number
              v-model:value="reserveTokens"
              :min="0"
              :step="1024"
              :disabled="!compactionEnabled"
          /></a-form-item>
          <a-form-item label="近期保留 Token"
            ><a-input-number
              v-model:value="keepRecentTokens"
              :min="0"
              :step="1024"
              :disabled="!compactionEnabled"
          /></a-form-item>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="settings-card compact-card">
          <template #title>失败重试</template>
          <template #extra><a-switch v-model:checked="retryEnabled" /></template>
          <a-typography-text type="secondary" class="card-help"
            >只处理临时性错误。</a-typography-text
          >
          <a-form-item label="最大重试次数"
            ><a-input-number
              v-model:value="maxRetries"
              :min="0"
              :max="20"
              :disabled="!retryEnabled"
          /></a-form-item>
          <a-form-item label="基础延迟 (ms)"
            ><a-input-number
              v-model:value="retryDelay"
              :min="0"
              :step="500"
              :disabled="!retryEnabled"
          /></a-form-item>
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false" class="settings-card">
      <template #title>隐私</template>
      <template #extra
        ><a-typography-text type="secondary">Pi 遥测选项</a-typography-text></template
      >
      <div class="setting-list-item">
        <div>
          <a-typography-text strong>安装与更新遥测</a-typography-text
          ><a-typography-text type="secondary"
            >发送匿名 Pi 版本信息；不影响版本检查</a-typography-text
          >
        </div>
        <a-switch v-model:checked="telemetry" />
      </div>
    </a-card>
  </a-form>
</template>
