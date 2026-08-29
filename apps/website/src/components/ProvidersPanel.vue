<script setup lang="ts">
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "@lucide/vue";
import { message } from "antdv-next";
import { computed, ref, watch } from "vue";
import type { ModelIssue } from "../model-validation.ts";
import ModelEditor from "./ModelEditor.vue";
import {
  type ModelConfiguration,
  type ModelsConfiguration,
  type ProviderPreset,
  REDACTED,
  type SecretReference,
} from "../types.ts";

const props = defineProps<{
  models: ModelsConfiguration;
  secretRefs: SecretReference[];
  presets: ProviderPreset[];
  issues: ModelIssue[];
  presetsRefreshing?: boolean;
}>();
const emit = defineEmits<{ "refresh-presets": []; change: [value: ModelsConfiguration] }>();

/** Plain JSON round trip: detaches copies from reactive proxies and props. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Working copy: every edit lands here and is emitted upward; props stay untouched. */
const working = ref(clone(props.models));
watch(
  () => props.models,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(working.value)) working.value = clone(value);
  },
  { deep: true },
);
watch(working, (value) => emit("change", clone(value)), { deep: true });

const selectedId = ref("");
const addOpen = ref(false);
const addMode = ref<"preset" | "manual">("preset");
const draftId = ref("");
const draftPresetId = ref("");
const importOpen = ref(false);
const importPresetId = ref("");
const importSelection = ref<string[]>([]);
const editing = ref<ModelConfiguration | null>(null);
const modelColumns = [
  { title: "模型 ID", key: "id", width: 210 },
  { title: "显示名称", key: "name", width: 150 },
  { title: "上下文窗口", key: "context", width: 130 },
  { title: "能力", key: "capabilities", width: 155 },
  { title: "计费", key: "cost", width: 105 },
  { title: "", key: "actions", width: 84 },
];

const providerIds = computed(() => Object.keys(working.value.providers).sort());
const provider = computed(() => working.value.providers[selectedId.value]);
const providerSegmentOptions = computed(() =>
  providerIds.value.map((id) => ({ label: id, value: id })),
);
const providerIssues = computed(() =>
  props.issues.filter((issue) => issue.providerId === selectedId.value),
);
const providerLevelIssues = computed(() =>
  providerIssues.value.filter((issue) => issue.modelIndex === null),
);
const presetsWithModels = computed(() =>
  props.presets.filter((preset) => preset.models.length > 0),
);
const importPreset = computed(() =>
  presetsWithModels.value.find((preset) => preset.id === importPresetId.value),
);
const existingModelIds = computed(
  () => new Set((provider.value?.models ?? []).map((model) => model.id)),
);
const editingIssues = computed(() => {
  const index = editing.value ? (provider.value?.models?.indexOf(editing.value) ?? -1) : -1;
  if (index < 0) return [];
  return providerIssues.value
    .filter((issue) => issue.modelIndex === index)
    .map((issue) => issue.message);
});

/**
 * The form only ever produces a `$VAR_NAME` reference. The agent reads that variable from
 * its own environment when it authenticates, so no key is ever written to models.json.
 */
const keyVariable = computed<string>({
  get: () => {
    const value = provider.value?.apiKey ?? "";
    return value.startsWith("$") ? value.slice(1) : "";
  },
  set: (value) => {
    if (!provider.value) return;
    const name = value.replaceAll(/[^A-Za-z0-9_]/g, "_").toUpperCase();
    if (name) provider.value.apiKey = `$${name}`;
    else delete provider.value.apiKey;
  },
});
const hasLiteralKey = computed(() => provider.value?.apiKey === REDACTED);
const isCommandKey = computed(() => provider.value?.apiKey?.startsWith("!") ?? false);
const keyStatus = computed(() =>
  props.secretRefs.find((reference) => reference.name === keyVariable.value),
);

watch(
  providerIds,
  (ids) => {
    if (!ids.includes(selectedId.value)) selectedId.value = ids[0] ?? "";
  },
  { immediate: true },
);

watch(addOpen, (open) => {
  if (!open) return;
  addMode.value = props.presets.length > 0 ? "preset" : "manual";
  draftPresetId.value = props.presets[0]?.id ?? "";
  draftId.value = "";
});

watch(importOpen, (open) => {
  if (!open) return;
  const matching = presetsWithModels.value.find((preset) => preset.id === selectedId.value);
  importPresetId.value = (matching ?? presetsWithModels.value[0])?.id ?? "";
  importSelection.value = [];
});

watch(importPresetId, () => {
  importSelection.value = [];
});

function createProvider(id: string, value: ModelsConfiguration["providers"][string]): boolean {
  if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(id)) {
    message.error("Provider ID 只能包含字母、数字、点、斜杠、下划线或连字符");
    return false;
  }
  if (working.value.providers[id]) {
    message.error("该 Provider 已存在");
    return false;
  }

  working.value.providers[id] = value;
  selectedId.value = id;
  addOpen.value = false;
  return true;
}

function addProvider() {
  createProvider(draftId.value.trim(), { api: "openai-completions", models: [] });
}

function addProviderFromPreset() {
  const preset = props.presets.find((item) => item.id === draftPresetId.value);
  if (!preset) return;

  const id = draftId.value.trim() || preset.id;
  // 已存在则直接切换过去，而不是假死
  if (working.value.providers[id]) {
    selectedId.value = id;
    addOpen.value = false;
    message.info(
      `“${id}” 已存在，已为你切换到该 Provider。如需同步最新模型，请用「从预设添加模型」或「刷新预设」`,
    );
    return;
  }

  const created = createProvider(id, {
    ...clone(preset.provider),
    models: clone(preset.models),
  });
  if (created)
    message.success(
      preset.models.length
        ? `已导入 ${preset.label}，含 ${preset.models.length} 个模型，请核对参数与价格`
        : `已导入 ${preset.label} 的连接信息，请自行添加模型`,
    );
}
function removeProvider() {
  delete working.value.providers[selectedId.value];
}

/** Drops the literal value so the next save writes a reference instead. */
function convertLiteralKey() {
  if (!provider.value) return;
  provider.value.apiKey = `$${selectedId.value.replaceAll(/[^A-Za-z0-9_]/g, "_").toUpperCase()}_API_KEY`;
}

function addModel() {
  if (!provider.value) return;
  const model: ModelConfiguration = { id: "", input: ["text"], reasoning: false };
  (provider.value.models ??= []).push(model);
  editing.value = model;
}

function importModels() {
  if (!provider.value || !importPreset.value) return;

  const chosen = importPreset.value.models.filter((model) =>
    importSelection.value.includes(model.id),
  );
  if (chosen.length === 0) {
    message.warning("先选择要添加的模型");
    return;
  }

  (provider.value.models ??= []).push(...clone(chosen));
  importOpen.value = false;
  message.success(`已添加 ${chosen.length} 个模型，请核对参数与价格`);
}

function removeModel(model: ModelConfiguration) {
  const index = provider.value?.models?.indexOf(model) ?? -1;
  if (index >= 0) provider.value?.models?.splice(index, 1);
  if (editing.value === model) editing.value = null;
}

function setModelInput(model: ModelConfiguration, type: "text" | "image", enabled: boolean) {
  const values = new Set(model.input ?? ["text"]);
  if (enabled) values.add(type);
  else values.delete(type);
  model.input = [...values];
}

function modelIssues(index: number): string[] {
  return providerIssues.value
    .filter((issue) => issue.modelIndex === index)
    .map((issue) => issue.message);
}

function costSummary(model: ModelConfiguration): string {
  const { input, output } = model.cost ?? {};
  if (typeof input !== "number" && typeof output !== "number") return "—";
  return `$${input ?? 0} / $${output ?? 0}`;
}

function modelRowKey(model: ModelConfiguration) {
  return String(provider.value?.models?.indexOf(model) ?? 0);
}
</script>

<template>
  <div class="panel-stack">
    <div class="provider-switch">
      <a-segmented
        v-if="providerIds.length"
        :value="selectedId"
        :options="providerSegmentOptions"
        @change="(value: unknown) => (selectedId = value as string)"
      />
      <a-button type="dashed" @click="addOpen = true"><Plus :size="15" />添加 Provider</a-button>
    </div>

    <template v-if="provider">
      <a-card :bordered="false" class="panel-card">
        <template #title>{{ selectedId }}</template>
        <template #extra
          ><a-popconfirm
            title="确定删除这个 Provider？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="removeProvider"
            ><a-button type="text" danger size="small"
              ><Trash2 :size="15" />删除</a-button
            ></a-popconfirm
          ></template
        >
        <a-alert v-if="hasLiteralKey" type="warning" show-icon class="key-alert">
          <template #message>配置文件里存在明文密钥</template>
          <template #description
            >PIM 不保存密钥值。点「改用变量」会把它换成一个环境变量引用，保存后原明文将从
            models.json 中移除（仍会留在 .pim/backups 的备份里），请先确认你已经把这个值导出到 shell
            环境。</template
          >
          <template #action
            ><a-button size="small" @click="convertLiteralKey">改用变量</a-button></template
          >
        </a-alert>
        <a-form layout="vertical">
          <a-row :gutter="20">
            <a-col :span="24"
              ><a-form-item
                label="Base URL"
                :validate-status="providerLevelIssues.length ? 'error' : undefined"
                :help="providerLevelIssues[0]?.message"
                ><a-input
                  v-model:value="provider.baseUrl"
                  placeholder="https://api.example.com/v1" /></a-form-item
            ></a-col>
            <a-col :xs="24" :md="12"
              ><a-form-item label="API 类型"
                ><a-select v-model:value="provider.api"
                  ><a-select-option value="openai-completions"
                    >OpenAI Chat Completions</a-select-option
                  ><a-select-option value="openai-responses">OpenAI Responses</a-select-option
                  ><a-select-option value="anthropic-messages">Anthropic Messages</a-select-option
                  ><a-select-option value="google-generative-ai"
                    >Google Generative AI</a-select-option
                  ></a-select
                ></a-form-item
              ></a-col
            >
            <a-col :xs="24" :md="12">
              <a-form-item label="API Key 环境变量">
                <a-input
                  v-if="!isCommandKey"
                  v-model:value="keyVariable"
                  addon-before="$"
                  placeholder="PI_OPENAI_API_KEY"
                  :disabled="hasLiteralKey"
                />
                <a-input v-else :value="provider.apiKey" disabled />
                <template #extra>
                  <span v-if="isCommandKey">命令引用，如需修改请使用高级 JSON。</span>
                  <span v-else-if="!keyVariable">留空表示该 Provider 不需要密钥。</span>
                  <span v-else-if="keyStatus?.present">
                    <a-tag color="success">环境变量已就绪</a-tag>Agent 启动时会自行读取它去授权。
                  </span>
                  <span v-else>
                    <TriangleAlert :size="12" /> 当前 PIM 进程里没有这个变量，记得在启动 Agent 的
                    shell 里 export。
                  </span>
                </template>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-card :bordered="false" class="panel-card" :body-style="{ paddingTop: '12px' }">
        <template #title>模型目录</template>
        <template #extra>
          <a-space :size="8">
            <a-tooltip title="拉取 OpenCode 官网文档中的最新模型与价格，更新预设">
              <a-button
                type="text"
                size="small"
                :loading="props.presetsRefreshing"
                @click="emit('refresh-presets')"
                ><RefreshCw :size="15" />刷新预设</a-button
              >
            </a-tooltip>
            <a-button
              v-if="presetsWithModels.length"
              type="text"
              size="small"
              @click="importOpen = true"
              ><Sparkles :size="15" />从预设添加</a-button
            >
            <a-button type="primary" ghost size="small" @click="addModel"
              ><Plus :size="15" />添加模型</a-button
            >
          </a-space>
        </template>
        <a-table
          :columns="modelColumns"
          :data-source="provider.models ?? []"
          :pagination="false"
          :row-key="modelRowKey"
          size="middle"
          :scroll="{ x: 880 }"
          :row-class-name="
            (_record: ModelConfiguration, index: number) =>
              modelIssues(index).length ? 'model-row-invalid' : ''
          "
        >
          <template #bodyCell="{ column, record, index }">
            <a-tooltip
              v-if="column.key === 'id'"
              :title="modelIssues(index)[0]"
              :open="modelIssues(index).length ? undefined : false"
            >
              <a-input
                v-model:value="record.id"
                placeholder="model-id"
                :status="modelIssues(index).length ? 'error' : undefined"
              />
            </a-tooltip>
            <a-input
              v-else-if="column.key === 'name'"
              v-model:value="record.name"
              placeholder="可选"
            />
            <a-input-number
              v-else-if="column.key === 'context'"
              v-model:value="record.contextWindow"
              :min="1"
              placeholder="128000"
            />
            <a-space v-else-if="column.key === 'capabilities'" :size="10"
              ><a-checkbox v-model:checked="record.reasoning">推理</a-checkbox
              ><a-checkbox
                :checked="record.input?.includes('image')"
                @change="
                  (event: { target: { checked: boolean } }) =>
                    setModelInput(record, 'image', event.target.checked)
                "
                >图片</a-checkbox
              ></a-space
            >
            <a-typography-text v-else-if="column.key === 'cost'" type="secondary">{{
              costSummary(record)
            }}</a-typography-text>
            <a-space v-else-if="column.key === 'actions'" :size="0">
              <a-tooltip title="编辑全部参数"
                ><a-button type="text" shape="circle" @click="editing = record"
                  ><Pencil :size="15" /></a-button
              ></a-tooltip>
              <a-tooltip title="删除模型"
                ><a-button type="text" danger shape="circle" @click="removeModel(record)"
                  ><Trash2 :size="15" /></a-button
              ></a-tooltip>
            </a-space>
          </template>
          <template #emptyText><a-empty description="尚未添加模型" /></template>
        </a-table>
      </a-card>
    </template>

    <a-card v-else :bordered="false" class="panel-card panel-empty">
      <a-empty description="添加 Provider 后开始配置模型"
        ><a-button type="primary" @click="addOpen = true"
          ><Plus :size="16" />添加 Provider</a-button
        ></a-empty
      >
    </a-card>

    <a-modal
      v-model:open="addOpen"
      title="添加 Provider"
      ok-text="添加"
      cancel-text="取消"
      :width="560"
      @ok="addMode === 'preset' ? addProviderFromPreset() : addProvider()"
    >
      <a-segmented
        v-if="presets.length"
        :value="addMode"
        :options="[
          { label: '从预设导入', value: 'preset' },
          { label: '手动创建', value: 'manual' },
        ]"
        class="preset-mode"
        @change="(value: unknown) => (addMode = value as 'preset' | 'manual')"
      />

      <template v-if="addMode === 'preset' && presets.length">
        <a-radio-group v-model:value="draftPresetId" class="preset-list">
          <a-radio
            v-for="preset in presets"
            :key="preset.id"
            :value="preset.id"
            class="preset-item"
          >
            <div class="preset-item-body">
              <div class="preset-item-head">
                <a-typography-text strong>{{ preset.label }}</a-typography-text>
                <a-tag v-if="working.providers[preset.id]" color="green">已添加</a-tag>
                <a-tag v-else-if="preset.models.length">{{ preset.models.length }} 个模型</a-tag>
                <a-tag v-else color="default">仅连接信息</a-tag>
              </div>
              <a-typography-text type="secondary">{{ preset.description }}</a-typography-text>
              <a-typography-text type="secondary" class="preset-item-url">{{
                preset.provider.baseUrl ?? "无需 Base URL"
              }}</a-typography-text>
            </div>
          </a-radio>
        </a-radio-group>
        <a-form layout="vertical" class="preset-form">
          <a-form-item
            label="Provider ID"
            :extra="`留空则使用 ${draftPresetId}${working.providers[draftPresetId] ? '（已存在，点击添加将切换过去）' : ''}`"
          >
            <a-input v-model:value="draftId" :placeholder="draftPresetId" />
          </a-form-item>
        </a-form>
        <a-alert type="info" show-icon>
          <template #message>预设只是起点</template>
          <template #description
            >模型 ID
            和价格会随厂商调整，导入后请对照官方文档核对；若发现列表过时，在「模型目录」点「刷新预设」可从官网文档同步最新模型与价格。密钥仍然只写环境变量引用。</template
          >
        </a-alert>
      </template>

      <a-form v-else layout="vertical"
        ><a-form-item label="Provider ID" extra="例如 ollama 或 company-proxy"
          ><a-input v-model:value="draftId" autofocus @press-enter="addProvider" /></a-form-item
      ></a-form>
    </a-modal>

    <a-modal
      v-model:open="importOpen"
      title="从预设添加模型"
      ok-text="添加"
      cancel-text="取消"
      :width="560"
      @ok="importModels"
    >
      <a-form layout="vertical">
        <a-alert
          v-if="!presetsWithModels.length"
          type="info"
          show-icon
          message="暂无可用预设模型"
          description="可点「刷新预设」从官网文档同步，或手动在模型目录添加。"
          class="preset-empty-alert"
        />
        <a-form-item label="预设来源">
          <a-select
            v-model:value="importPresetId"
            placeholder="选择预设"
            :not-found-content="presetsWithModels.length ? undefined : '暂无预设'"
            :disabled="!presetsWithModels.length"
          >
            <a-select-option v-for="preset in presetsWithModels" :key="preset.id" :value="preset.id"
              >{{ preset.label }}
            </a-select-option>
          </a-select>
          <template #extra>
            <a
              v-if="importPreset?.docsUrl"
              :href="importPreset.docsUrl"
              target="_blank"
              rel="noopener"
              >官方模型文档 <ExternalLink :size="12"
            /></a>
          </template>
        </a-form-item>
        <a-form-item label="选择模型">
          <a-checkbox-group v-model:value="importSelection" class="preset-model-list">
            <a-checkbox
              v-for="model in importPreset?.models ?? []"
              :key="model.id"
              :value="model.id"
              :disabled="existingModelIds.has(model.id)"
            >
              {{ model.name ?? model.id }}
              <a-typography-text type="secondary">{{ model.id }}</a-typography-text>
              <a-tag v-if="existingModelIds.has(model.id)" color="default">已存在</a-tag>
            </a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <ModelEditor
      :open="Boolean(editing)"
      :model="editing"
      :provider-id="selectedId"
      :provider-api="provider?.api"
      :issues="editingIssues"
      @close="editing = null"
    />
  </div>
</template>
