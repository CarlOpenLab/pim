<script setup lang="ts">
import { KeyRound, Plus, Server, Trash2 } from "@lucide/vue";
import message from "antdv-next/dist/message/index";
import { computed, ref, watch } from "vue";
import type { CredentialStatus, ModelConfiguration, ModelsConfiguration } from "../types.ts";

const props = defineProps<{ models: ModelsConfiguration; credentials: CredentialStatus[] }>();
const selectedId = ref("");
const addProviderOpen = ref(false);
const providerIdDraft = ref("");
const modelColumns = [
  { title: "模型 ID", key: "id", width: 190 },
  { title: "显示名称", key: "name", width: 170 },
  { title: "上下文窗口", key: "context", width: 130 },
  { title: "能力", key: "capabilities", width: 140 },
  { title: "", key: "actions", width: 48 },
];

const providerIds = computed(() => Object.keys(props.models.providers).sort());
const provider = computed(() => props.models.providers[selectedId.value]);
const credential = computed(() =>
  props.credentials.find((item) => item.provider === selectedId.value),
);

watch(
  providerIds,
  (ids) => {
    if (!ids.includes(selectedId.value)) selectedId.value = ids[0] ?? "";
  },
  { immediate: true },
);

function addProvider() {
  const id = providerIdDraft.value.trim();
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
  providerIdDraft.value = "";
  addProviderOpen.value = false;
}

function removeProvider() {
  delete props.models.providers[selectedId.value];
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
  <a-card :bordered="false" class="provider-card" :body-style="{ padding: 0 }">
    <div class="provider-workbench">
      <aside class="provider-navigation">
        <div class="provider-nav-header">
          <div>
            <a-typography-text strong>自定义 Provider</a-typography-text
            ><a-typography-text type="secondary">{{ providerIds.length }} 个配置</a-typography-text>
          </div>
          <a-tooltip title="添加 Provider"
            ><a-button type="text" shape="circle" @click="addProviderOpen = true"
              ><Plus :size="17" /></a-button
          ></a-tooltip>
        </div>
        <a-menu
          :selected-keys="selectedId ? [selectedId] : []"
          mode="inline"
          class="provider-menu"
          @click="({ key }: { key: string }) => (selectedId = key)"
        >
          <a-menu-item v-for="id in providerIds" :key="id"
            ><template #icon><Server :size="16" /></template
            ><span class="provider-menu-label">{{ id }}</span
            ><a-badge v-if="credentials.some((item) => item.provider === id)" status="success"
          /></a-menu-item>
        </a-menu>
        <div class="credential-panel">
          <a-divider orientation="left" plain>认证状态</a-divider>
          <a-space v-for="item in credentials" :key="item.provider" class="credential-item"
            ><KeyRound :size="14" /><a-typography-text code>{{ item.provider }}</a-typography-text
            ><a-tag color="success">{{ item.type }}</a-tag></a-space
          >
          <a-typography-text v-if="credentials.length === 0" type="secondary"
            >未发现 auth.json 凭据</a-typography-text
          >
        </div>
      </aside>

      <section v-if="provider" class="provider-content">
        <div class="provider-title-row">
          <div>
            <a-space
              ><a-avatar shape="square" class="provider-avatar">{{
                selectedId.slice(0, 2).toUpperCase()
              }}</a-avatar>
              <div>
                <a-space
                  ><a-typography-title :level="4">{{ selectedId }}</a-typography-title
                  ><a-tag v-if="credential" color="success">已认证</a-tag
                  ><a-tag v-else>未认证</a-tag></a-space
                ><a-typography-text type="secondary">配置写入全局 models.json</a-typography-text>
              </div></a-space
            >
          </div>
          <a-popconfirm
            title="确定删除这个 Provider？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="removeProvider"
            ><a-button danger><Trash2 :size="16" />删除</a-button></a-popconfirm
          >
        </div>
        <a-divider />
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
            <a-col :xs="24" :md="12"
              ><a-form-item
                label="API Key / 引用"
                extra="支持环境变量、!command 或字面值；字面值读取后会脱敏"
                ><a-input-password
                  v-model:value="provider.apiKey"
                  placeholder="$PROVIDER_API_KEY" /></a-form-item
            ></a-col>
          </a-row>
        </a-form>
        <a-divider orientation="left">模型目录</a-divider>
        <div class="table-toolbar">
          <a-typography-text type="secondary">模型 ID 会原样发送给上游 API</a-typography-text
          ><a-button type="primary" ghost @click="addModel"><Plus :size="16" />添加模型</a-button>
        </div>
        <a-table
          :columns="modelColumns"
          :data-source="provider.models ?? []"
          :pagination="false"
          :row-key="modelRowKey"
          size="middle"
          :scroll="{ x: 720 }"
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
            <a-space v-else-if="column.key === 'capabilities'" direction="vertical" :size="4"
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
      </section>
      <section v-else class="provider-empty">
        <a-empty description="添加 Provider 后开始配置"
          ><a-button type="primary" @click="addProviderOpen = true"
            ><Plus :size="16" />添加 Provider</a-button
          ></a-empty
        >
      </section>
    </div>
  </a-card>

  <a-modal
    v-model:open="addProviderOpen"
    title="添加 Provider"
    ok-text="添加"
    cancel-text="取消"
    @ok="addProvider"
  >
    <a-form layout="vertical"
      ><a-form-item label="Provider ID" extra="例如 ollama 或 company-proxy"
        ><a-input
          v-model:value="providerIdDraft"
          autofocus
          @press-enter="addProvider" /></a-form-item
    ></a-form>
  </a-modal>
</template>
