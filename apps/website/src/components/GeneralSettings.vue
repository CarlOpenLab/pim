<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Zap } from "@lucide/vue";
import type { ModelsConfiguration, OmpAvailableModel, OmpRolePreset } from "../types.ts";

const props = defineProps<{
  settings: Record<string, unknown>;
  agentId?: string;
  rolePresets?: OmpRolePreset[];
  models?: ModelsConfiguration;
  availableModels?: OmpAvailableModel[];
}>();

const emit = defineEmits<{ change: [value: Record<string, unknown>] }>();

/** Everything here is plain JSON, so a round trip detaches the working copy from props. */
function cloneSettings(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * Children never mutate props: edits land on this working copy and are emitted upward;
 * App writes them back into the configuration, and the guard below re-syncs only when
 * the change came from somewhere else (JSON editor, reload, agent switch).
 */
const working = ref(cloneSettings(props.settings));
watch(
  () => props.settings,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(working.value))
      working.value = cloneSettings(value);
  },
  { deep: true },
);
watch(working, (value) => emit("change", cloneSettings(value)), { deep: true });

function field<T>(key: string, fallback: T) {
  return computed<T>({
    get: () => (working.value[key] as T | undefined) ?? fallback,
    set: (value) => {
      working.value[key] = value;
    },
  });
}

const defaultProvider = field("defaultProvider", "");
const defaultModel = field("defaultModel", "");
const thinkingLevel = field("defaultThinkingLevel", "medium");
const enabledModels = field<string[]>("enabledModels", []);

// —— 模型相关下拉的数据源：从 models.providers + availableModels 汇聚 —— //
const providerOptions = computed(() => {
  const ids = Object.keys(props.models?.providers ?? {}).sort();
  const options = ids.map((id) => ({ value: id, label: id }));
  // 文件里已保存的值不在可选列表时仍然展示，避免“看着像没配置”
  const current = (defaultProvider.value as string) || "";
  if (current && !options.some((option) => option.value === current))
    options.unshift({ value: current, label: current });
  return options;
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
  const options = source.map((selector) => ({ value: selector, label: selector }));
  // settings.json 里可能是裸模型 id（无 provider 前缀），保留为可选项防止选不中
  const current = (defaultModel.value as string) || "";
  if (current && !options.some((option) => option.value === current))
    options.unshift({ value: current, label: current });
  return options;
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
</script>
<template>
  <a-form layout="vertical" class="panel-stack">
    <a-card :bordered="false" class="panel-card">
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
  </a-form>
</template>
