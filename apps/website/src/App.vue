<script setup lang="ts">
import { Code2, Cpu, Crown, RefreshCw, Save, Settings, SlidersHorizontal } from "@lucide/vue";
import { message, Modal } from "antdv-next";
import { computed, onMounted, ref, watch } from "vue";
import {
  getDefaultProjectPath,
  listAgents,
  listAvailableModels,
  listModelPresets,
  listRolePresets,
  loadConfiguration,
  refreshAgentPresets,
  saveModelRoles,
  saveModels,
  saveSettings,
} from "./api.ts";
import AgentRail from "./components/AgentRail.vue";
import GeneralSettings from "./components/GeneralSettings.vue";
import JsonInspector from "./components/JsonInspector.vue";
import OmpModelRoles from "./components/OmpModelRoles.vue";
import OmpRoleSelector from "./components/OmpRoleSelector.vue";
import PersonaEditor from "./components/PersonaEditor.vue";
import ProvidersPanel from "./components/ProvidersPanel.vue";
import { pruneEmptyValues, validateModels } from "./model-validation.ts";
import type {
  AgentConfiguration,
  AgentSummary,
  ConfigScope,
  ModelsConfiguration,
  OmpAvailableModel,
  OmpRolePreset,
  ProviderPreset,
  ViewId,
} from "./types.ts";
/**
 * Tabs are derived from the adapter's declared capabilities, so a new agent only needs a
 * backend adapter — no changes here.
 */
const sectionCatalog = [
  // OMP 专属：模型·角色 / 人格·预设
  { key: "model", label: "模型 · 角色", icon: Cpu, caps: ["model", "modelRoles"] },
  { key: "persona", label: "人格 · 预设", icon: Crown, caps: ["persona", "roles"] },
  // 通用
  { key: "settings", label: "基础设置", icon: Settings, caps: ["settings"] },
  { key: "providers", label: "模型服务", icon: SlidersHorizontal, caps: ["providers", "models"] },
] as const;

const agents = ref<AgentSummary[]>([]);
const presets = ref<ProviderPreset[]>([]);
const rolePresets = ref<OmpRolePreset[]>([]);
const agentId = ref("pi");
const config = ref<AgentConfiguration | null>(null);
const scope = ref<ConfigScope>("global");
const projectPath = ref("");
const activeView = ref<ViewId>("settings");
const jsonOpen = ref(false);
const loading = ref(true);
const saving = ref(false);
const availableModels = ref<OmpAvailableModel[]>([]);
const presetsRefreshing = ref(false);
const loadError = ref("");
const settingsBaseline = ref("");
const modelsBaseline = ref("");

const settings = computed(() => config.value?.settings.data ?? {});
const models = computed<ModelsConfiguration>(() => config.value?.models.data ?? { providers: {} });
const diagnostics = computed(() => [
  ...(config.value?.settings.diagnostics ?? []),
  ...(config.value?.models.diagnostics ?? []),
]);
const hasBlockingError = computed(() => diagnostics.value.some((item) => item.level === "error"));
const modelIssues = computed(() => validateModels(models.value));
const isDirty = computed(
  () =>
    JSON.stringify(settings.value) !== settingsBaseline.value ||
    JSON.stringify(models.value) !== modelsBaseline.value,
);
/** Names the first thing standing between the current edits and a successful save. */
const saveBlocker = computed(() => {
  if (loadError.value) return "无法连接到 Pim API";
  if (hasBlockingError.value) return "配置文件本身有错误，请先在高级 JSON 里修好";
  const [issue] = modelIssues.value;
  if (issue)
    return issue.modelIndex === null
      ? `${issue.providerId}：${issue.message}`
      : `${issue.providerId} 第 ${issue.modelIndex + 1} 个模型：${issue.message}`;
  if (!isDirty.value) return "没有需要保存的修改";
  return "";
});
const sections = computed(() => {
  const caps = config.value?.agent.capabilities ?? [];
  return sectionCatalog.filter((section) => section.caps.some((c: string) => caps.includes(c)));
});
const isModelsView = computed(() => activeView.value === "providers");
const currentPath = computed(() =>
  isModelsView.value ? (config.value?.models.path ?? "") : (config.value?.settings.path ?? ""),
);

async function load(nextAgent = agentId.value, nextScope = scope.value) {
  loading.value = true;
  loadError.value = "";
  try {
    if (!projectPath.value) projectPath.value = await getDefaultProjectPath();
    if (agents.value.length === 0) agents.value = await listAgents();
    // Presets are a convenience — an adapter that ships none must not break the load.
    const [nextConfig, nextPresets, nextRolePresets, nextAvailableModels] = await Promise.all([
      loadConfiguration(nextAgent, nextScope, projectPath.value),
      listModelPresets(nextAgent).catch(() => [] as ProviderPreset[]),
      nextAgent === "omp"
        ? listRolePresets(nextAgent).catch(() => [] as OmpRolePreset[])
        : Promise.resolve([] as OmpRolePreset[]),
      nextAgent === "omp"
        ? listAvailableModels(nextAgent).catch(() => [] as OmpAvailableModel[])
        : Promise.resolve([] as OmpAvailableModel[]),
    ]);
    config.value = nextConfig;
    presets.value = nextPresets;
    rolePresets.value = nextRolePresets;
    availableModels.value = nextAvailableModels;
    agentId.value = nextAgent;
    scope.value = nextScope;
    settingsBaseline.value = JSON.stringify(config.value.settings.data);
    modelsBaseline.value = JSON.stringify(config.value.models.data);
    if (!sections.value.some((section) => section.key === activeView.value))
      activeView.value = (sections.value[0]?.key ?? "settings") as ViewId;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "无法连接到 Pim API";
  } finally {
    loading.value = false;
  }
}

/** Reloading drops in-memory edits, so confirm first whenever something is unsaved. */
function reload(nextAgent = agentId.value, nextScope = scope.value) {
  if (!isDirty.value) return load(nextAgent, nextScope);

  Modal.confirm({
    title: "放弃未保存的修改？",
    content: "重新读取配置文件会丢弃当前修改。",
    okText: "放弃修改",
    cancelText: "继续编辑",
    onOk: () => load(nextAgent, nextScope),
  });
}

/** Pulls the latest model catalog/prices from upstream docs and swaps it into the presets. */
async function refreshPresets() {
  presetsRefreshing.value = true;
  try {
    presets.value = await refreshAgentPresets(agentId.value);
    message.success("预设已从官网文档刷新，可到「从预设添加」导入最新模型");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "刷新预设失败");
  } finally {
    presetsRefreshing.value = false;
  }
}

const modelRoles = computed<Record<string, string>>(
  () => (settings.value.modelRoles as Record<string, string> | undefined) ?? {},
);

const mergedAvailableModels = computed<OmpAvailableModel[]>(() => {
  const base = availableModels.value;
  if (agentId.value !== "omp") return base;
  const providers = (models.value.providers ?? {}) as Record<string, any>;
  const custom: OmpAvailableModel[] = [];
  for (const [pid, p] of Object.entries(providers)) {
    for (const m of (p.models ?? []) as Array<Record<string, any>>) {
      custom.push({
        provider: pid,
        id: m.id,
        selector: `${pid}/${m.id}`,
        name: (m.name as string) || m.id,
        reasoning: !!m.reasoning,
        thinking: m.reasoning ? ["minimal", "low", "medium", "high", "xhigh", "max"] : ["off"],
        input: (m.input as string[]) ?? ["text"],
        contextWindow: m.contextWindow as number | undefined,
        maxTokens: m.maxTokens as number | undefined,
        cost: m.cost as any,
      });
    }
  }
  const seen: Record<string, true> = {};
  for (const m of base) seen[m.selector] = true;
  const extra = custom.filter((m) => !seen[m.selector]);
  return [...base, ...extra];
});

async function handleSaveModelRoles(roles: Record<string, string>) {
  saving.value = true;
  try {
    await saveModelRoles(agentId.value, roles);
    (settings.value as Record<string, unknown>).modelRoles = { ...roles };
    settingsBaseline.value = JSON.stringify(settings.value);
    message.success("已保存模型角色绑定，重启 OMP 或新开会话生效");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function save() {
  if (!config.value || hasBlockingError.value) return;
  if (modelIssues.value.length > 0) {
    message.error(saveBlocker.value);
    return;
  }

  pruneEmptyValues(models.value);
  saving.value = true;
  try {
    const results = [];
    if (JSON.stringify(settings.value) !== settingsBaseline.value)
      results.push(
        await saveSettings(agentId.value, scope.value, projectPath.value, settings.value),
      );
    if (JSON.stringify(models.value) !== modelsBaseline.value)
      results.push(await saveModels(agentId.value, models.value));
    settingsBaseline.value = JSON.stringify(settings.value);
    modelsBaseline.value = JSON.stringify(models.value);
    message.success(results.length ? `已保存 ${results.length} 个配置文件` : "没有需要保存的修改");
    if (results.some((result) => result.backupPath)) message.info("已为原文件创建备份");
    const migrated = results.flatMap((result) => result.migratedKeys ?? []);
    if (migrated.length)
      message.info(`已将 ${migrated.join("、")} 迁移到 omp config，settings.json 不再保存这些键`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

function applyJson(value: Record<string, unknown>) {
  if (!config.value) return;
  if (isModelsView.value) config.value.models.data = value as unknown as ModelsConfiguration;
  else config.value.settings.data = value;
}

/** Panels emit their working copy; App owns the configuration state. */
function applySettingsDraft(value: Record<string, unknown>) {
  if (config.value) config.value.settings.data = value;
}

function applyModelsDraft(value: ModelsConfiguration) {
  if (config.value) config.value.models.data = value;
}

watch(projectPath, (value, oldValue) => {
  if (value !== oldValue && scope.value === "project" && value.trim())
    load(agentId.value, "project");
});

onMounted(() => load());
</script>

<template>
  <a-config-provider
    :theme="{ token: { colorPrimary: '#1677ff', borderRadius: 6, colorBgLayout: '#f5f6f8' } }"
  >
    <div class="app-shell">
      <AgentRail :agents="agents" :active-id="agentId" @select="(id) => reload(id, scope)" />

      <main class="app-main">
        <header class="app-bar">
          <a-segmented
            :value="scope"
            :options="[
              { label: '全局', value: 'global' },
              { label: '项目', value: 'project' },
            ]"
            @change="(value: unknown) => reload(agentId, value as ConfigScope)"
          />
          <a-input
            v-if="scope === 'project'"
            v-model:value="projectPath"
            size="small"
            class="bar-path"
          />
          <a-tooltip v-else :title="currentPath"
            ><span class="bar-path-text">{{ currentPath }}</span></a-tooltip
          >
          <div class="bar-right">
            <a-badge
              v-if="config?.agent.available"
              status="success"
              :text="`${config.agent.name} ${config.agent.version}`"
            />
            <a-badge v-else status="warning" :text="`未检测到 ${config?.agent.name ?? ''} CLI`" />
            <a-tooltip title="重新读取配置"
              ><a-button type="text" shape="circle" :loading="loading" @click="reload()"
                ><RefreshCw :size="16" /></a-button
            ></a-tooltip>
            <a-tooltip title="高级 JSON"
              ><a-button type="text" shape="circle" @click="jsonOpen = true"
                ><Code2 :size="16" /></a-button
            ></a-tooltip>
            <a-tooltip :title="saveBlocker">
              <span>
                <a-button
                  type="primary"
                  :disabled="Boolean(saveBlocker)"
                  :loading="saving"
                  @click="save"
                  ><Save :size="15" />保存<span v-if="isDirty" class="bar-dirty"
                /></a-button>
              </span>
            </a-tooltip>
          </div>
        </header>

        <a-tabs
          :active-key="activeView"
          class="app-tabs"
          @change="(key: unknown) => (activeView = key as ViewId)"
        >
          <a-tab-pane v-for="section in sections" :key="section.key">
            <template #tab
              ><span class="tab-label"
                ><component :is="section.icon" :size="15" />{{ section.label }}</span
              ></template
            >
          </a-tab-pane>
        </a-tabs>

        <section class="app-content">
          <div class="content-wrap">
            <a-alert
              v-if="loadError"
              type="error"
              show-icon
              :message="loadError"
              description="请确认 Pim API 正在运行，并检查当前配置目录权限。"
              class="content-alert"
            />
            <a-alert
              v-for="diagnostic in diagnostics"
              :key="diagnostic.file + diagnostic.message"
              type="error"
              show-icon
              :message="diagnostic.message"
              :description="diagnostic.file"
              class="content-alert"
            />
            <a-alert
              v-if="!loading && !loadError && modelIssues.length && activeView !== 'providers'"
              type="warning"
              show-icon
              class="content-alert"
            >
              <template #message>模型配置有 {{ modelIssues.length }} 处问题，保存已暂停</template>
              <template #description>
                {{ modelIssues[0]?.message }}
                <a @click="activeView = 'providers'">去「模型服务」处理</a>
              </template>
            </a-alert>
            <div v-if="loading" class="loading-state">
              <a-spin size="large" /><a-typography-text type="secondary"
                >正在读取配置...</a-typography-text
              >
            </div>
            <template v-else-if="config && !loadError">
              <GeneralSettings
                v-if="activeView === 'settings'"
                :settings="settings"
                :agent-id="agentId"
                :role-presets="rolePresets"
                :models="models as any"
                :available-models="mergedAvailableModels"
                @change="applySettingsDraft"
              />
              <OmpModelRoles
                v-else-if="activeView === 'model' || activeView === 'modelRoles'"
                :model-roles="modelRoles"
                :available-models="mergedAvailableModels"
                :loading="loading"
                :saving="saving"
                @save="handleSaveModelRoles"
              />
              <div
                v-else-if="activeView === 'persona' || activeView === 'roles'"
                class="panel-stack"
              >
                <a-card :bordered="false" class="panel-card">
                  <OmpRoleSelector
                    :active-id="
                      (settings.activeRole as string) ?? (settings.role as string) ?? 'coder'
                    "
                    :presets="rolePresets"
                    :custom-roles="settings.roles as any"
                    @select="
                      (id: string) => {
                        (settings as any).activeRole = id;
                        (settings as any).role = id;
                      }
                    "
                  />
                  <a-typography-text type="secondary" class="persona-hint">
                    点击卡片切换当前人格；修改要写进配置文件，请点右上角「保存」。
                  </a-typography-text>
                </a-card>
                <a-card :bordered="false" class="panel-card">
                  <template #title>
                    <span class="card-title">自定义人格</span>
                    <span class="card-subtitle">写入 settings.json → roles，可选预设之外的 id</span>
                  </template>
                  <PersonaEditor
                    :roles="(settings.roles as any) ?? []"
                    @change="(roles: any) => ((settings as any).roles = roles)"
                  />
                </a-card>
              </div>
              <ProvidersPanel
                v-else-if="activeView === 'providers'"
                :models="models"
                :presets="presets"
                :issues="modelIssues"
                :presets-refreshing="presetsRefreshing"
                @refresh-presets="refreshPresets"
                @change="applyModelsDraft"
              />
            </template>
          </div>
        </section>
      </main>
    </div>

    <a-drawer
      v-model:open="jsonOpen"
      title="高级 JSON"
      placement="right"
      :width="680"
      destroy-on-close
    >
      <JsonInspector
        :value="isModelsView ? models : settings"
        :title="isModelsView ? 'models.json' : 'settings.json'"
        :path="currentPath"
        :has-error="hasBlockingError"
        @apply="applyJson"
      />
    </a-drawer>
  </a-config-provider>
</template>
