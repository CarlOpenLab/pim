<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { message } from "antdv-next";
import { computed, ref, watch } from "vue";
import type { ModelConfiguration, ModelCost, ProviderApi } from "../types.ts";

const props = defineProps<{
  open: boolean;
  model: ModelConfiguration | null;
  providerId: string;
  /** Falls back to this when the model does not override the API shape. */
  providerApi?: ProviderApi;
  issues: string[];
}>();
const emit = defineEmits<{ close: [] }>();

/** Numeric inputs hand back null when cleared, which the write schema rejects — drop the key. */
function countField(key: "contextWindow" | "maxTokens") {
  return computed<number | undefined>({
    get: () => props.model?.[key],
    set: (value) => {
      if (!props.model) return;
      if (typeof value === "number" && Number.isFinite(value)) props.model[key] = value;
      else delete props.model[key];
    },
  });
}

function costField(key: keyof ModelCost & ("input" | "output" | "cacheRead" | "cacheWrite")) {
  return computed<number | undefined>({
    get: () => props.model?.cost?.[key],
    set: (value) => {
      if (!props.model) return;
      const cost: ModelCost = { ...props.model.cost };
      if (typeof value === "number" && Number.isFinite(value)) cost[key] = value;
      else delete cost[key];
      if (Object.keys(cost).length > 0) props.model.cost = cost;
      else delete props.model.cost;
    },
  });
}

const contextWindow = countField("contextWindow");
const maxTokens = countField("maxTokens");
const costInput = costField("input");
const costOutput = costField("output");
const costCacheRead = costField("cacheRead");
const costCacheWrite = costField("cacheWrite");

const api = computed<ProviderApi | undefined>({
  get: () => props.model?.api,
  set: (value) => {
    if (!props.model) return;
    if (value) props.model.api = value;
    else delete props.model.api;
  },
});
const acceptsImage = computed(() => props.model?.input?.includes("image") ?? false);
const title = computed(() => props.model?.id || "新模型");

/** `compat` is provider-specific and loosely typed, so it stays a JSON field. */
const compatRaw = ref("");
const compatError = ref("");

watch(
  () => props.model,
  (model) => {
    compatRaw.value = model?.compat ? JSON.stringify(model.compat, null, 2) : "";
    compatError.value = "";
  },
  { immediate: true },
);

function setImageInput(enabled: boolean) {
  if (!props.model) return;
  const values = new Set(props.model.input ?? ["text"]);
  if (enabled) values.add("image");
  else values.delete("image");
  props.model.input = [...values];
}

function applyCompat(): boolean {
  if (!props.model) return true;
  const text = compatRaw.value.trim();
  if (!text) {
    delete props.model.compat;
    compatError.value = "";
    return true;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("兼容参数必须是 JSON 对象");
    props.model.compat = parsed as Record<string, unknown>;
    compatError.value = "";
    return true;
  } catch (error) {
    compatError.value = error instanceof Error ? error.message : "JSON 无效";
    return false;
  }
}

function close() {
  if (!applyCompat()) {
    message.error(`兼容参数还不是合法 JSON：${compatError.value}`);
    return;
  }
  emit("close");
}
</script>

<template>
  <a-drawer
    :open="open"
    :title="`编辑模型 · ${title}`"
    placement="right"
    :width="480"
    destroy-on-close
    @close="close"
  >
    <template #extra><a-button type="primary" @click="close">完成</a-button></template>

    <a-form v-if="model" layout="vertical" class="model-editor">
      <a-alert
        v-if="issues.length"
        type="error"
        show-icon
        class="model-editor-alert"
        :message="issues.length > 1 ? `${issues.length} 处需要修正` : '需要修正'"
      >
        <template #description>
          <div v-for="issue in issues" :key="issue">{{ issue }}</div>
        </template>
      </a-alert>

      <a-row :gutter="16">
        <a-col :span="24">
          <a-form-item label="模型 ID" :extra="`发送给 ${providerId} 的模型名，必填`">
            <a-input v-model:value="model.id" placeholder="claude-opus-5" autofocus />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="显示名称" extra="只影响 Pi 里的模型选择列表">
            <a-input v-model:value="model.name" placeholder="可选" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="API 类型" extra="留空表示跟随 Provider 设置">
            <a-select
              v-model:value="api"
              allow-clear
              :placeholder="providerApi ? `跟随 Provider（${providerApi}）` : '跟随 Provider'"
            >
              <a-select-option value="openai-completions">OpenAI Chat Completions</a-select-option>
              <a-select-option value="openai-responses">OpenAI Responses</a-select-option>
              <a-select-option value="anthropic-messages">Anthropic Messages</a-select-option>
              <a-select-option value="google-generative-ai">Google Generative AI</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12">
          <a-form-item label="上下文窗口">
            <a-input-number
              v-model:value="contextWindow"
              :min="1"
              :step="1000"
              placeholder="200000"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12">
          <a-form-item label="最大输出">
            <a-input-number
              v-model:value="maxTokens"
              :min="1"
              :step="1000"
              placeholder="64000"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <div class="setting-list">
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>推理模型</a-typography-text>
            <a-typography-text type="secondary">开启后 Pi 会发送 thinking 参数</a-typography-text>
          </div>
          <a-switch v-model:checked="model.reasoning" />
        </div>
        <div class="setting-list-item">
          <div>
            <a-typography-text strong>图片输入</a-typography-text>
            <a-typography-text type="secondary">允许把截图和图片发给这个模型</a-typography-text>
          </div>
          <a-switch :checked="acceptsImage" @change="setImageInput" />
        </div>
      </div>

      <a-divider orientation="left" class="model-editor-divider">计费（每百万 token）</a-divider>
      <a-row :gutter="16">
        <a-col :xs="12" :sm="6">
          <a-form-item label="输入">
            <a-input-number
              v-model:value="costInput"
              :min="0"
              :step="0.1"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="12" :sm="6">
          <a-form-item label="输出">
            <a-input-number
              v-model:value="costOutput"
              :min="0"
              :step="0.1"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="12" :sm="6">
          <a-form-item label="缓存读">
            <a-input-number
              v-model:value="costCacheRead"
              :min="0"
              :step="0.01"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="12" :sm="6">
          <a-form-item label="缓存写">
            <a-input-number
              v-model:value="costCacheWrite"
              :min="0"
              :step="0.01"
              class="model-editor-number"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-typography-text type="secondary" class="model-editor-hint">
        只用于 Pi 里显示会话花费，留空表示不统计。
      </a-typography-text>

      <a-divider orientation="left" class="model-editor-divider">兼容参数</a-divider>
      <a-form-item :validate-status="compatError ? 'error' : undefined" :help="compatError">
        <textarea
          v-model="compatRaw"
          class="json-editor model-editor-compat"
          spellcheck="false"
          placeholder='{ "thinkingFormat": "deepseek" }'
          @blur="applyCompat"
        />
        <template #extra>
          <span v-if="!compatError">
            provider 私有开关，例如 thinkingFormat、reasoningEffortMap。写成 JSON 对象即可。
          </span>
        </template>
      </a-form-item>
      <a-typography-text v-if="compatError" type="danger" class="model-editor-hint">
        <TriangleAlert :size="12" />修好之后才会写入配置。
      </a-typography-text>
    </a-form>
  </a-drawer>
</template>
