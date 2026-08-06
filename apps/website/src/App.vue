<script setup lang="ts">
import {
  CheckCircle2,
  Code2,
  FolderOpen,
  KeyRound,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  Server,
  Settings,
  SlidersHorizontal,
  Wrench,
} from "@lucide/vue";
import { message, Modal } from "antdv-next";
import { computed, onMounted, ref, watch } from "vue";
import { getDefaultProjectPath, loadPiConfiguration, savePiModels, savePiSettings } from "./api.ts";
import GeneralSettings from "./components/GeneralSettings.vue";
import JsonInspector from "./components/JsonInspector.vue";
import ProvidersPanel from "./components/ProvidersPanel.vue";
import ResourcesPanel from "./components/ResourcesPanel.vue";
import type { AgentConfiguration, ConfigScope, ModelsConfiguration, ViewId } from "./types.ts";

const config = ref<AgentConfiguration | null>(null);
const scope = ref<ConfigScope>("global");
const projectPath = ref("");
const activeView = ref<ViewId>("settings");
const collapsed = ref(false);
const jsonOpen = ref(false);
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const lastSavedAt = ref<string | null>(null);
const settingsBaseline = ref("");
const modelsBaseline = ref("");

const settings = computed(() => config.value?.settings.data ?? {});
const models = computed<ModelsConfiguration>(() => config.value?.models.data ?? { providers: {} });
const settingsPath = computed(() => config.value?.settings.path ?? "");
const modelsPath = computed(() => config.value?.models.path ?? "");
const settingsHasError = computed(() =>
  Boolean(config.value?.settings.diagnostics.some((item) => item.level === "error")),
);
const modelsHasError = computed(() =>
  Boolean(config.value?.models.diagnostics.some((item) => item.level === "error")),
);
const isDirty = computed(
  () =>
    JSON.stringify(settings.value) !== settingsBaseline.value ||
    JSON.stringify(models.value) !== modelsBaseline.value,
);
const currentJson = computed(() =>
  activeView.value === "providers" ? models.value : settings.value,
);
const currentPath = computed(() =>
  activeView.value === "providers" ? modelsPath.value : settingsPath.value,
);
const currentJsonHasError = computed(() =>
  activeView.value === "providers" ? modelsHasError.value : settingsHasError.value,
);
const pageTitle = computed(() =>
  activeView.value === "settings"
    ? "基础设置"
    : activeView.value === "providers"
      ? "Providers & 模型"
      : "资源管理",
);

async function loadConfiguration(nextScope = scope.value) {
  loading.value = true;
  loadError.value = "";
  try {
    if (!projectPath.value) projectPath.value = await getDefaultProjectPath();
    config.value = await loadPiConfiguration(nextScope, projectPath.value);
    scope.value = nextScope;
    settingsBaseline.value = JSON.stringify(config.value.settings.data);
    modelsBaseline.value = JSON.stringify(config.value.models.data);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "无法连接到 Pim API";
  } finally {
    loading.value = false;
  }
}

function changeScope(nextScope: ConfigScope) {
  if (nextScope === scope.value) return;
  if (isDirty.value) {
    Modal.confirm({
      title: "放弃未保存的修改？",
      content: "切换配置作用域会重新读取文件，当前修改将丢失。",
      okText: "放弃修改",
      cancelText: "继续编辑",
      onOk: () => loadConfiguration(nextScope),
    });
    return;
  }
  loadConfiguration(nextScope);
}

function selectView(key: string) {
  activeView.value = key as ViewId;
}

async function save() {
  if (!config.value || settingsHasError.value || modelsHasError.value) return;
  saving.value = true;
  try {
    const settingsChanged = JSON.stringify(settings.value) !== settingsBaseline.value;
    const modelsChanged = JSON.stringify(models.value) !== modelsBaseline.value;
    const results = [];
    if (settingsChanged)
      results.push(await savePiSettings(scope.value, projectPath.value, settings.value));
    if (modelsChanged) results.push(await savePiModels(models.value));
    settingsBaseline.value = JSON.stringify(settings.value);
    modelsBaseline.value = JSON.stringify(models.value);
    lastSavedAt.value = results.at(-1)?.savedAt ?? new Date().toISOString();
    message.success(results.length ? `已保存 ${results.length} 个配置文件` : "没有需要保存的修改");
    if (results.some((result) => result.backupPath)) message.info("已为原文件创建备份");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

function applyJson(value: Record<string, unknown>) {
  if (!config.value) return;
  if (activeView.value === "providers")
    config.value.models.data = value as unknown as ModelsConfiguration;
  else config.value.settings.data = value;
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "尚未保存";
}

watch(projectPath, (value, oldValue) => {
  if (value !== oldValue && scope.value === "project" && value.trim()) loadConfiguration("project");
});

onMounted(() => loadConfiguration());
</script>

<template>
  <a-config-provider
    :theme="{ token: { colorPrimary: '#1677ff', borderRadius: 6, colorBgLayout: '#f5f6f8' } }"
  >
    <a-layout class="app-layout">
      <a-layout-sider
        v-model:collapsed="collapsed"
        :width="248"
        :collapsed-width="64"
        collapsible
        theme="light"
        class="app-sider"
      >
        <div class="sider-brand" :class="{ collapsed }">
          <span class="brand-mark">P</span>
          <div v-if="!collapsed"><strong>PIM</strong><span>Agent Config Studio</span></div>
        </div>
        <div v-if="!collapsed" class="sider-agent">
          <a-avatar :size="34" class="agent-avatar">π</a-avatar>
          <div><strong>Pi Agent</strong><span>本机配置</span></div>
          <Server :size="16" />
        </div>
        <div v-if="!collapsed" class="sider-caption">CONFIGURATION SPACE</div>
        <a-segmented
          v-if="!collapsed"
          block
          :value="scope"
          :options="[
            { label: '全局配置', value: 'global' },
            { label: '项目配置', value: 'project' },
          ]"
          class="sider-scope"
          @change="(value: unknown) => changeScope(value as ConfigScope)"
        />
        <a-tooltip v-else title="切换配置作用域" placement="right"
          ><a-button
            type="text"
            class="collapsed-scope"
            @click="changeScope(scope === 'global' ? 'project' : 'global')"
            ><FolderOpen :size="18" /></a-button
        ></a-tooltip>
        <a-menu
          :selected-keys="[activeView]"
          mode="inline"
          class="sider-menu"
          @click="({ key }: { key: string }) => selectView(key)"
        >
          <a-menu-item key="settings"
            ><template #icon><Settings :size="17" /></template>基础设置</a-menu-item
          >
          <a-menu-item key="providers"
            ><template #icon><SlidersHorizontal :size="17" /></template>Providers &
            模型</a-menu-item
          >
          <a-menu-item key="resources"
            ><template #icon><Package :size="17" /></template>资源管理</a-menu-item
          >
        </a-menu>
        <div v-if="!collapsed" class="sider-bottom">
          <a-space><KeyRound :size="15" /><span>认证凭据</span></a-space
          ><a-badge
            :count="config?.credentials.length ?? 0"
            :number-style="{ backgroundColor: '#f0f0f0', color: '#666', boxShadow: 'none' }"
          />
        </div>
        <template #trigger
          ><PanelLeftOpen v-if="collapsed" :size="16" /><PanelLeftClose v-else :size="16"
        /></template>
      </a-layout-sider>

      <a-layout>
        <a-layout-header class="app-header">
          <div class="header-left">
            <a-breadcrumb
              ><a-breadcrumb-item>PIM</a-breadcrumb-item
              ><a-breadcrumb-item>Pi Agent</a-breadcrumb-item
              ><a-breadcrumb-item>{{ pageTitle }}</a-breadcrumb-item></a-breadcrumb
            >
          </div>
          <a-space :size="14">
            <a-badge
              v-if="config?.agent.available"
              status="success"
              :text="`Pi ${config.agent.version}`"
            />
            <a-badge v-else status="warning" text="未检测到 Pi CLI" />
            <a-divider type="vertical" />
            <a-tooltip title="重新读取配置"
              ><a-button type="text" shape="circle" :loading="loading" @click="loadConfiguration()"
                ><RefreshCw :size="16" /></a-button
            ></a-tooltip>
            <a-button
              type="primary"
              :disabled="!isDirty || Boolean(loadError) || settingsHasError || modelsHasError"
              :loading="saving"
              @click="save"
              ><Save :size="16" />保存配置</a-button
            >
          </a-space>
        </a-layout-header>

        <a-layout-content class="app-content">
          <div class="content-wrap">
            <div class="page-header">
              <div>
                <a-typography-title :level="3">{{ pageTitle }}</a-typography-title
                ><a-typography-text type="secondary">{{
                  activeView === "settings"
                    ? "管理 Pi 的默认行为与会话体验"
                    : activeView === "providers"
                      ? "配置 API 连接、模型能力与认证状态"
                      : "管理 Pi 可加载的扩展与资源"
                }}</a-typography-text>
              </div>
              <a-button :type="jsonOpen ? 'primary' : 'default'" @click="jsonOpen = true"
                ><Code2 :size="16" />高级 JSON</a-button
              >
            </div>
            <a-alert v-if="scope === 'project'" type="info" show-icon class="project-alert"
              ><template #message>正在编辑项目配置</template
              ><template #description
                ><a-input v-model:value="projectPath" size="small" prefix="~" /><span
                  class="alert-hint"
                  >保存到该目录的 .pi/settings.json</span
                ></template
              ></a-alert
            >
            <a-alert
              v-if="loadError"
              type="error"
              show-icon
              :message="loadError"
              description="请确认 Pim API 正在运行，并检查当前配置目录权限。"
              class="content-alert"
            />
            <a-alert
              v-for="diagnostic in [
                ...(config?.settings.diagnostics ?? []),
                ...(config?.models.diagnostics ?? []),
              ]"
              :key="diagnostic.file + diagnostic.message"
              type="error"
              show-icon
              :message="diagnostic.message"
              :description="diagnostic.file"
              class="content-alert"
            />
            <div v-if="loading" class="loading-state">
              <a-spin size="large" /><a-typography-text type="secondary"
                >正在读取 Pi 配置...</a-typography-text
              >
            </div>
            <template v-else-if="config && !loadError">
              <GeneralSettings v-if="activeView === 'settings'" :settings="settings" />
              <ProvidersPanel
                v-else-if="activeView === 'providers'"
                :models="models"
                :credentials="config.credentials"
              />
              <ResourcesPanel v-else :settings="settings" />
            </template>
          </div>
        </a-layout-content>
        <a-layout-footer class="app-footer"
          ><a-space><CheckCircle2 :size="14" class="footer-success" />配置状态正常</a-space
          ><span>{{ currentPath }}</span
          ><a-space><Wrench :size="14" />仅本机服务</a-space
          ><span>最后保存：{{ formatTime(lastSavedAt) }}</span></a-layout-footer
        >
      </a-layout>
    </a-layout>

    <a-drawer
      v-model:open="jsonOpen"
      title="高级 JSON"
      placement="right"
      :width="520"
      destroy-on-close
    >
      <JsonInspector
        :value="currentJson"
        :title="activeView === 'providers' ? 'models.json' : 'settings.json'"
        :path="currentPath"
        :has-error="currentJsonHasError"
        @apply="applyJson"
      />
    </a-drawer>
  </a-config-provider>
</template>
