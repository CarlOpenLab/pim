<script setup lang="ts">
import { Plus, Trash2, TriangleAlert } from "@lucide/vue";
import message from "antdv-next/dist/message/index";
import { computed, ref, watch } from "vue";
import {
  type ModelConfiguration,
  type ModelsConfiguration,
  REDACTED,
  type SecretReference,
} from "../types.ts";

const props = defineProps<{ models: ModelsConfiguration; secretRefs: SecretReference[] }>();
const selectedId = ref("");
const addOpen = ref(false);
const draftId = ref("");
const modelColumns = [
  { title: "模型 ID", key: "id", width: 200 },
  { title: "显示名称", key: "name", width: 160 },
  { title: "上下文窗口", key: "context", width: 130 },
  { title: "能力", key: "capabilities", width: 130 },
  { title: "", key: "actions", width: 48 },
];

const providerIds = computed(() => Object.keys(props.models.providers).sort());
const provider = computed(() => props.models.providers[selectedId.value]);

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

function addProvider() {
  const id = draftId.value.trim();
  if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(id)) {
    message.error("Provider ID 只能包含字母、数字、点、斜杠、下划线或连字符");
    return;
  }
  if (props.models.providers[id]) {
    message.error("该 Provider 已存在");
    return;
  }
  props.models.providers[id] = { api: "openai-completions", models: [] };
  selectedId.value = id;
  draftId.value = "";
  addOpen.value = false;
}

function removeProvider() {
  delete props.models.providers[selectedId.value];
}

/** Drops the literal value so the next save writes a reference instead. */
function convertLiteralKey() {
  if (!provider.value) return;
  provider.value.apiKey = `$${selectedId.value.replaceAll(/[^A-Za-z0-9_]/g, "_").toUpperCase()}_API_KEY`;
}

function addModel() {
  if (!provider.value) return;
  (provider.value.models ??= []).push({ id: "", input: ["text"], reasoning: false });
}

function removeModel(model: ModelConfiguration) {
  const index = provider.value?.models?.indexOf(model) ?? -1;
  if (index >= 0) provider.value?.models?.splice(index, 1);
}

function setModelInput(model: ModelConfiguration, type: "text" | "image", enabled: boolean) {
  const values = new Set(model.input ?? ["text"]);
  if (enabled) values.add(type);
  else values.delete(type);
  model.input = [...values];
}

function modelRowKey(model: ModelConfiguration) {
  return model.id || String(provider.value?.models?.indexOf(model) ?? 0);
}
</script>

<template>
  <div class="panel-stack">
    <div class="provider-switch">
      <a-segmented
        v-if="providerIds.length"
        :value="selectedId"
        :options="providerIds"
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
              ><a-form-item label="Base URL"
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
        <template #extra
          ><a-button type="primary" ghost size="small" @click="addModel"
            ><Plus :size="15" />添加模型</a-button
          ></template
        >
        <a-table
          :columns="modelColumns"
          :data-source="provider.models ?? []"
          :pagination="false"
          :row-key="modelRowKey"
          size="middle"
          :scroll="{ x: 700 }"
        >
          <template #bodyCell="{ column, record }">
            <a-input v-if="column.key === 'id'" v-model:value="record.id" placeholder="model-id" />
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
            <a-tooltip v-else-if="column.key === 'actions'" title="删除模型"
              ><a-button type="text" danger shape="circle" @click="removeModel(record)"
                ><Trash2 :size="15" /></a-button
            ></a-tooltip>
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
      @ok="addProvider"
    >
      <a-form layout="vertical"
        ><a-form-item label="Provider ID" extra="例如 ollama 或 company-proxy"
          ><a-input v-model:value="draftId" autofocus @press-enter="addProvider" /></a-form-item
      ></a-form>
    </a-modal>
  </div>
</template>
