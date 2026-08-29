<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Copy, Crown, PencilLine, Plus, Save, Sparkles, Trash2, Zap } from "@lucide/vue";
import { message } from "antdv-next";
import type { OmpAvailableModel } from "../types.ts";

const props = defineProps<{
  modelRoles: Record<string, string>;
  availableModels: OmpAvailableModel[];
  loading?: boolean;
  /** True while the parent is persisting, so the save button reflects the real request. */
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [roles: Record<string, string>];
}>();

type RoleMeta = { label: string; desc: string; icon: string; color: string; group: string };
const ROLE_META: Record<string, RoleMeta> = {
  default: {
    label: "主力 default",
    desc: "日常编码 · 默认会话",
    icon: "⚡",
    color: "#1677ff",
    group: "core",
  },
  smol: {
    label: "极速 smol",
    desc: "轻量 · 秒级响应",
    icon: "🐹",
    color: "#52c41a",
    group: "core",
  },
  slow: {
    label: "深度 slow",
    desc: "慢思考 · 长推理",
    icon: "🐢",
    color: "#722ed1",
    group: "core",
  },
  plan: {
    label: "规划 plan",
    desc: "架构 · 方案推演",
    icon: "🗺️",
    color: "#fa8c16",
    group: "core",
  },
  code: {
    label: "编码 code",
    desc: "重型实现 · 大上下文",
    icon: "💻",
    color: "#13c2c2",
    group: "extended",
  },
  review: {
    label: "评审 review",
    desc: "挑剔 CR · 找坑",
    icon: "🔍",
    color: "#fa541c",
    group: "extended",
  },
  ask: {
    label: "问答 ask",
    desc: "快速问答 · 轻推理",
    icon: "💬",
    color: "#2f54eb",
    group: "extended",
  },
  vision: {
    label: "视觉 vision",
    desc: "多模态 · 图像理解",
    icon: "👁️",
    color: "#eb2f96",
    group: "extended",
  },
  designer: {
    label: "设计 designer",
    desc: "UI/原型 · 视觉打磨",
    icon: "🎨",
    color: "#eb2f96",
    group: "extended",
  },
  deep: {
    label: "深研 deep",
    desc: "超长思考 · 研究",
    icon: "🧠",
    color: "#722ed1",
    group: "extended",
  },
};

const CORE_ORDER = ["default", "smol", "slow", "plan"];
const EXTENDED_ORDER = ["code", "review", "ask", "vision", "designer", "deep"];
const BUILTIN_ORDER = [...CORE_ORDER, ...EXTENDED_ORDER];

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

const draft = ref<Record<string, string>>({});
const newRoleId = ref("");
/** Per-role toggle between the model dropdown and free-text input for custom selectors. */
const manualMode = ref<Record<string, boolean>>({});

function isManualMode(role: string): boolean {
  if (manualMode.value[role] !== undefined) return manualMode.value[role];
  // 已保存的自定义 selector 不在可选列表里时，默认落在手输模式，避免看起来丢了值
  const selector = parse(draft.value[role] ?? "").selector;
  return Boolean(selector) && !getModelInfo(selector);
}

function toggleManualMode(role: string) {
  manualMode.value = { ...manualMode.value, [role]: !isManualMode(role) };
}

watch(
  () => props.modelRoles,
  (v) => {
    draft.value = { ...v };
  },
  { immediate: true, deep: true },
);

type Parsed = { selector: string; thinking: string };
function parse(value: string): Parsed {
  const lastColon = value.lastIndexOf(":");
  if (lastColon === -1) return { selector: value, thinking: "medium" };
  const suffix = value.slice(lastColon + 1);
  if ((THINKING_LEVELS as readonly string[]).includes(suffix)) {
    return { selector: value.slice(0, lastColon), thinking: suffix };
  }
  return { selector: value, thinking: "medium" };
}

function stringify(selector: string, thinking: string): string {
  if (!selector) return "";
  if (!thinking || thinking === "medium") return selector;
  return `${selector}:${thinking}`;
}

const sortedRoles = computed(() => {
  const keys = Object.keys(draft.value);
  const builtin = BUILTIN_ORDER.filter((k) => keys.includes(k));
  const custom = keys.filter((k) => !BUILTIN_ORDER.includes(k)).sort();
  if (builtin.length === 0 && custom.length === 0) return ["default"];
  // keep core first, then extended in order, then custom alphabetic
  return [...builtin, ...custom];
});

const suggestedRoles = computed(() => {
  const existing = new Set(Object.keys(draft.value));
  return BUILTIN_ORDER.filter((k) => !existing.has(k));
});

const groupedModels = computed(() => {
  const groups: Record<string, OmpAvailableModel[]> = {};
  for (const m of props.availableModels) {
    const g = m.provider || "other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(m);
  }
  return groups;
});

const modelOptions = computed(() => {
  return Object.entries(groupedModels.value).map(([provider, models]) => ({
    label: provider,
    options: models.map((m) => ({
      value: m.selector,
      label: `${m.name} · ${m.selector}`,
    })),
  }));
});

function getModelInfo(selector: string): OmpAvailableModel | undefined {
  return props.availableModels.find((m) => m.selector === selector);
}

function shortSelector(selector: string): string {
  if (!selector) return "";
  // keep provider prefix short if needed
  if (selector.length <= 34) return selector;
  const slash = selector.indexOf("/");
  if (slash !== -1 && selector.length > 40) {
    const provider = selector.slice(0, slash);
    const model = selector.slice(slash + 1);
    if (model.length > 22) return `${provider}/${model.slice(0, 18)}…${model.slice(-6)}`;
  }
  return selector;
}

// 根据选中模型的实际能力过滤思考级别，解决“下拉都是空的”或展示无效选项的问题
function thinkingOptionsFor(selector: string): readonly string[] {
  if (!selector) return THINKING_LEVELS;
  const info = getModelInfo(selector);
  if (!info) return THINKING_LEVELS;
  if (!info.reasoning) return ["off"];
  const supported = info.thinking;
  if (!supported || supported.length === 0) return THINKING_LEVELS;
  const allowed: Record<string, true> = { off: true };
  for (const lv of supported) allowed[lv] = true;
  // 若模型未显式包含 medium，仍保留 medium 作为可选项（OMP 默认）
  allowed["medium"] = true;
  return (THINKING_LEVELS as readonly string[]).filter((lv) => allowed[lv]);
}

function updateRole(role: string, selector: string, thinking: string) {
  const next = stringify(selector, thinking);
  if (next) draft.value[role] = next;
  else delete draft.value[role];
}

function handleSelectorChange(role: string, selector: string) {
  const cur = parse(draft.value[role] ?? "");
  // 校验 thinking 是否在新模型的可用范围内，否则回落到模型支持的首个级别
  const opts = thinkingOptionsFor(selector);
  const thinking = opts.includes(cur.thinking)
    ? cur.thinking
    : opts.includes("medium")
      ? "medium"
      : (opts[0] ?? "medium");
  updateRole(role, selector.trim(), thinking);
}

function handleThinkingChange(role: string, thinking: string) {
  const cur = parse(draft.value[role] ?? "");
  const sel = cur.selector;
  if (!sel) {
    message.warning("先选择模型");
    return;
  }
  updateRole(role, sel, thinking);
}
function addRole() {
  const id = newRoleId.value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/g, "");
  if (!id) {
    message.warning("输入角色名（字母数字_-）");
    return;
  }
  if (draft.value[id]) {
    message.warning("该角色已存在");
    return;
  }
  draft.value[id] = "";
  newRoleId.value = "";
}

function addSuggestedRole(id: string) {
  if (draft.value[id]) return;
  draft.value[id] = "";
  draft.value = { ...draft.value };
}

function removeRole(role: string) {
  delete draft.value[role];
  draft.value = { ...draft.value };
}

function applyPreset(kind: "balanced" | "speed" | "quality") {
  const find = (keyword: string) =>
    props.availableModels.find((m) => m.selector.includes(keyword))?.selector ??
    props.availableModels[0]?.selector ??
    "opencode-go/muse-spark-1.2-contributor";
  if (kind === "balanced") {
    draft.value.default = `${find("muse-spark")}:high`;
    draft.value.smol = `${find("deepseek-v4-flash")}:low`;
    draft.value.slow = `${find("grok-4.5") || find("deepseek-v4-pro")}:high`;
    if (!draft.value.plan) draft.value.plan = `${find("glm-5")}:high`;
  } else if (kind === "speed") {
    const flash = find("deepseek-v4-flash");
    draft.value.default = `${flash}:low`;
    draft.value.smol = `${flash}:minimal`;
    draft.value.slow = `${flash}:low`;
  } else if (kind === "quality") {
    draft.value.default = `${find("glm-5")}:high`;
    draft.value.slow = `${find("grok-4.5")}:max`;
    draft.value.smol = `${find("muse-spark")}:medium`;
  }
  draft.value = { ...draft.value };
  message.success(
    `已应用${kind === "balanced" ? "均衡" : kind === "speed" ? "极速" : "高质量"}预设，请点保存`,
  );
}

async function handleSave() {
  for (const role of Object.keys(draft.value)) {
    const v = draft.value[role];
    if (!v || !v.includes("/")) {
      message.error(`角色 ${role} 的模型未选择或格式错误（需 provider/model）`);
      return;
    }
  }
  emit("save", { ...draft.value });
}

function copySelector(selector: string) {
  navigator.clipboard.writeText(selector);
  message.success("已复制");
}

/** "$in/$out" per token row; both-zero means the provider charges nothing (显示“免费”). */
function costSummary(cost?: { input?: number; output?: number }): string {
  if (typeof cost?.input !== "number" && typeof cost?.output !== "number") return "—";
  if (!cost.input && !cost.output) return "免费";
  return `$${cost.input ?? 0} / $${cost.output ?? 0}`;
}

const searchQuery = ref("");
const filteredModels = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.availableModels;
  return props.availableModels.filter(
    (m) =>
      m.selector.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q),
  );
});

const availableColumns = [
  { title: "模型", dataIndex: "name", key: "name", width: 240 },
  { title: "provider", dataIndex: "provider", key: "provider", width: 90 },
  { title: "上下文", dataIndex: "contextWindow", key: "contextWindow", width: 80 },
  { title: "思考", dataIndex: "thinking", key: "thinking", width: 110 },
  { title: "价格", dataIndex: "cost", key: "cost", width: 90 },
  { title: "", key: "actions", width: 140 },
];

function assignToRole(selector: string, role: string) {
  const cur = parse(draft.value[role] ?? "");
  const thinking = cur.selector ? cur.thinking : "high";
  draft.value[role] = stringify(selector, thinking);
  draft.value = { ...draft.value };
  message.success(`已设为 ${role}: ${selector}`);
}
</script>

<template>
  <div class="model-roles">
    <div class="roles-head">
      <div class="roles-head-left">
        <Crown :size="16" />
        <span class="roles-title">模型 · 角色绑定</span>
        <a-typography-text type="secondary" class="roles-subtitle hide-sm"
          >为 OMP 的不同场景绑定不同模型，/model 切换即切角色</a-typography-text
        >
        <a-tag v-if="sortedRoles.length" color="blue" class="roles-count"
          >{{ sortedRoles.length }} 角色</a-tag
        >
      </div>
      <a-space wrap>
        <a-button size="small" @click="applyPreset('balanced')"><Zap :size="14" />均衡</a-button>
        <a-button size="small" @click="applyPreset('speed')">极速</a-button>
        <a-button size="small" @click="applyPreset('quality')">高质量</a-button>
        <a-button type="primary" :loading="saving || loading" @click="handleSave"
          ><Save :size="14" />保存绑定</a-button
        >
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      class="roles-tip"
      message="写法：provider/model:thinking ，例如 opencode-go/muse-spark-1.2-contributor:high — 思考级别 off/minimal/low/medium/high/xhigh/max"
    />

    <div class="role-grid">
      <div
        v-for="role in sortedRoles"
        :key="role"
        class="role-card"
        :class="{
          'is-core': CORE_ORDER.includes(role),
          'is-empty': !parse(draft[role] ?? '').selector,
        }"
        :style="{ '--accent': ROLE_META[role]?.color ?? '#1677ff' } as any"
      >
        <div class="role-card-head">
          <span class="role-icon" :style="{ background: ROLE_META[role]?.color ?? '#8c8c8c' }">{{
            ROLE_META[role]?.icon ?? "🎭"
          }}</span>
          <div class="role-meta">
            <span class="role-label" :title="ROLE_META[role]?.label ?? role">{{
              ROLE_META[role]?.label ?? role
            }}</span>
            <span class="role-desc" :title="ROLE_META[role]?.desc ?? '自定义角色'">{{
              ROLE_META[role]?.desc ?? "自定义角色"
            }}</span>
          </div>
          <a-tag
            :color="CORE_ORDER.includes(role) ? 'blue' : 'default'"
            class="role-key"
            :title="role"
            >{{ role }}</a-tag
          >
          <a-button
            v-if="role !== 'default'"
            type="text"
            size="small"
            danger
            class="role-del"
            @click="removeRole(role)"
            ><Trash2 :size="14"
          /></a-button>
        </div>

        <div class="role-card-body">
          <div class="role-field model-field">
            <span class="field-label">模型</span>
            <a-select
              v-if="!isManualMode(role)"
              :value="parse(draft[role] ?? '').selector || undefined"
              placeholder="选择模型"
              show-search
              allow-clear
              :filter-option="
                (input: string, option: any) =>
                  String(option.value).toLowerCase().includes(input.toLowerCase()) ||
                  String(option.label).toLowerCase().includes(input.toLowerCase())
              "
              class="model-select"
              :options="modelOptions"
              :not-found-content="
                availableModels.length
                  ? '无匹配模型，可切换到手输自定义'
                  : '暂无可用模型，请先 omp models refresh 或在下方表格搜索添加'
              "
              @change="(v: string) => handleSelectorChange(role, v ?? '')"
            />
            <a-input
              v-else
              :value="parse(draft[role] ?? '').selector"
              placeholder="provider/model · 可手输自定义模型"
              allow-clear
              class="custom-input"
              @update:value="
                (v: string) => handleSelectorChange(role, (v as unknown as string) || '')
              "
            />
            <a-tooltip :title="isManualMode(role) ? '切换为下拉选择' : '切换为手输 selector'">
              <a-button type="text" size="small" class="mode-btn" @click="toggleManualMode(role)"
                ><PencilLine :size="14"
              /></a-button>
            </a-tooltip>
            <a-tooltip v-if="parse(draft[role] ?? '').selector" title="复制 selector"
              ><a-button
                type="text"
                size="small"
                class="copy-btn"
                @click="copySelector(parse(draft[role] ?? '').selector)"
                ><Copy :size="14" /></a-button
            ></a-tooltip>
          </div>

          <div class="role-field thinking-field">
            <span class="field-label">思考</span>
            <a-select
              :value="parse(draft[role] ?? '').thinking"
              class="thinking-select"
              :options="
                thinkingOptionsFor(parse(draft[role] ?? '').selector).map((lv) => ({
                  value: lv,
                  label: lv,
                }))
              "
              @change="(v: string) => handleThinkingChange(role, v)"
            />
            <span class="field-hint" title="已按模型能力过滤">按模型过滤</span>
          </div>

          <!-- 选中后的紧凑信息条，长文本省略 -->
          <div v-if="getModelInfo(parse(draft[role] ?? '').selector)" class="role-model-info">
            <span
              class="info-name"
              :title="getModelInfo(parse(draft[role] ?? '').selector)?.name"
              >{{ getModelInfo(parse(draft[role] ?? "").selector)?.name }}</span
            >
            <span class="info-dot">·</span>
            <span class="info-ctx"
              >{{
                getModelInfo(parse(draft[role] ?? "").selector)?.contextWindow?.toLocaleString() ??
                "—"
              }}
              上下文</span
            >
            <span class="info-dot">·</span>
            <span
              class="info-cost"
              :title="String(getModelInfo(parse(draft[role] ?? '').selector)?.cost ?? '')"
            >
              {{ costSummary(getModelInfo(parse(draft[role] ?? "").selector)?.cost) }}
            </span>
            <a-tag
              v-if="getModelInfo(parse(draft[role] ?? '').selector)?.reasoning"
              color="purple"
              class="info-tag"
              >推理</a-tag
            >
            <!-- 长 selector 展示，省略 + tooltip -->
            <a-tooltip :title="parse(draft[role] ?? '').selector">
              <span class="info-selector">{{
                shortSelector(parse(draft[role] ?? "").selector)
              }}</span>
            </a-tooltip>
          </div>
          <div v-else-if="parse(draft[role] ?? '').selector" class="role-model-info is-warn">
            <a-typography-text type="warning" class="warn-text"
              >未在可用模型中找到，仍可保存</a-typography-text
            >
            <a-tooltip :title="parse(draft[role] ?? '').selector">
              <span class="info-selector mono">{{
                shortSelector(parse(draft[role] ?? "").selector)
              }}</span>
            </a-tooltip>
          </div>
          <div v-else class="role-model-info is-empty-hint">
            未绑定模型 — 从下方列表一键绑定或下拉选择
          </div>
        </div>
      </div>
    </div>

    <!-- 推荐角色：omp 不止 4 个，快速添加 -->
    <div v-if="suggestedRoles.length" class="suggest-row">
      <span class="suggest-label"><Sparkles :size="12" /> 推荐角色</span>
      <a-tag
        v-for="rid in suggestedRoles"
        :key="rid"
        class="suggest-tag"
        :color="ROLE_META[rid]?.color ? undefined : 'default'"
        :style="
          ROLE_META[rid]?.color
            ? { borderColor: ROLE_META[rid].color, color: ROLE_META[rid].color }
            : {}
        "
        @click="addSuggestedRole(rid)"
      >
        <span style="margin-right: 4px">{{ ROLE_META[rid]?.icon }}</span
        >{{ rid }}
      </a-tag>
      <span class="suggest-hint">点击即添加卡片，任意 key 均可（会写入 modelRoles）</span>
    </div>

    <div class="role-add">
      <a-input
        v-model:value="newRoleId"
        placeholder="新角色 id，如 designer / reviewer"
        class="add-input"
        allow-clear
        @press-enter="addRole"
      />
      <a-button @click="addRole"><Plus :size="14" />添加角色</a-button>
      <a-typography-text type="secondary" class="add-hint"
        >自定义 key 会写入 modelRoles，OMP 重启即生效</a-typography-text
      >
    </div>

    <a-card :bordered="false" class="panel-card available-card">
      <template #title>
        <span class="card-title">可用模型 · {{ availableModels.length }}</span>
        <span class="card-subtitle hide-sm">来自 `omp models --json`，点击一键绑定到角色</span>
      </template>
      <template #extra>
        <a-input
          v-model:value="searchQuery"
          placeholder="搜索模型 / provider"
          allow-clear
          class="search-input"
        />
      </template>
      <a-table
        :columns="availableColumns"
        :data-source="filteredModels as any"
        :pagination="{ pageSize: 8, showSizeChanger: false }"
        row-key="selector"
        size="small"
        :scroll="{ x: 720 }"
        class="model-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="cell-name" :title="(record as OmpAvailableModel).name">
              {{ (record as OmpAvailableModel).name }}
            </div>
            <a-tooltip :title="(record as OmpAvailableModel).selector">
              <div class="cell-selector">{{ (record as OmpAvailableModel).selector }}</div>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'provider'">
            <a-tag class="cell-provider">{{ (record as OmpAvailableModel).provider }}</a-tag>
          </template>
          <template v-else-if="column.key === 'contextWindow'">
            <span class="cell-ctx">{{
              (record as OmpAvailableModel).contextWindow?.toLocaleString() ?? "—"
            }}</span>
          </template>
          <template v-else-if="column.key === 'thinking'">
            <span
              class="cell-thinking"
              :title="(record as OmpAvailableModel).thinking?.join(' / ') || ''"
              >{{ (record as OmpAvailableModel).thinking?.join(" / ") || "—" }}</span
            >
          </template>
          <template v-else-if="column.key === 'cost'">
            <span class="cell-cost">{{ costSummary((record as OmpAvailableModel).cost) }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="cell-actions">
              <a-button
                v-for="role in sortedRoles.slice(0, 6)"
                :key="role"
                size="small"
                type="text"
                class="action-btn"
                :title="`设为 ${role}`"
                @click="assignToRole((record as OmpAvailableModel).selector, role)"
                >{{ role }}</a-button
              >
              <a-dropdown v-if="sortedRoles.length > 6" :trigger="['click']">
                <a-button size="small" type="text">…</a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item
                      v-for="role in sortedRoles.slice(6)"
                      :key="role"
                      @click="assignToRole((record as OmpAvailableModel).selector, role)"
                      >设为 {{ role }}</a-menu-item
                    >
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </template>
      </a-table>
      <a-typography-text type="secondary" class="table-foot">
        提示：表格中的“设为…”会直接填充上方对应角色的模型，改完记得点右上角“保存绑定”。卡片支持任意自定义角色，不限于
        default/smol/slow/plan。
      </a-typography-text>
    </a-card>

    <div class="roles-foot">
      <a-typography-text type="secondary" class="foot-text">
        小技巧：命令行仍可用 <code>omp --model opus</code> /
        <code>omp --smol xxx --slow yyy --plan zzz</code> 临时覆盖；PIM 的绑定是持久化
        <code>modelRoles</code> 到 <code>~/.omp/agent/config.yml</code>，<code>cycleOrder</code>
        决定 Ctrl+P 轮询顺序。
      </a-typography-text>
    </div>
  </div>
</template>

<style scoped>
.model-roles {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.roles-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.roles-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.roles-title {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}
.roles-subtitle {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.roles-count {
  flex-shrink: 0;
}
.roles-tip {
  border-radius: 8px;
}
.roles-tip :deep(.ant-alert-message) {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  align-items: start;
}
.role-card {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.role-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border-color: var(--accent);
}
.role-card.is-empty {
  border-style: dashed;
}
.role-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 10%, transparent) 0,
    transparent 360px
  );
  background-color: #fafafa;
  min-width: 0;
}
.role-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
}
.role-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.role-label {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-desc {
  font-size: 11px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.role-del {
  flex-shrink: 0;
  padding: 0 6px;
}
.role-card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.role-field {
  display: grid;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.model-field {
  grid-template-columns: 36px minmax(0, 1fr) 24px 24px;
}
.custom-input {
  min-width: 0;
}
.thinking-field {
  grid-template-columns: 36px 150px minmax(0, 1fr);
}
.field-label {
  font-size: 12px;
  color: #595959;
  white-space: nowrap;
}
.model-select {
  min-width: 0;
  width: 100%;
}
.model-select :deep(.ant-select-selector) {
  min-width: 0;
}
.model-select :deep(.ant-select-selection-item) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.thinking-select {
  width: 150px;
}
.field-hint {
  font-size: 11px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.copy-btn {
  flex-shrink: 0;
}
.role-model-info {
  font-size: 12px;
  background: #fafafa;
  padding: 7px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
}
.role-model-info.is-warn {
  background: #fffbe6;
  border: 1px solid #ffe58f;
}
.role-model-info.is-empty-hint {
  color: #8c8c8c;
  font-size: 11px;
  justify-content: center;
  border: 1px dashed #d9d9d9;
  background: #fff;
}
.info-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.info-dot {
  color: #bfbfbf;
  flex-shrink: 0;
}
.info-ctx,
.info-cost {
  white-space: nowrap;
  color: #595959;
  font-size: 11px;
}
.info-tag {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1;
  padding: 0 4px;
}
.info-selector {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #8c8c8c;
  background: #fff;
  border: 1px solid #f0f0f0;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  min-width: 0;
  flex: 1 1 160px;
}
.info-selector.mono {
  max-width: 100%;
}
.warn-text {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.suggest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 2px;
  min-width: 0;
}
.suggest-label {
  font-size: 12px;
  color: #595959;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.suggest-tag {
  cursor: pointer;
  user-select: none;
  border-radius: 999px;
  transition: all 0.15s;
}
.suggest-tag:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
.suggest-hint {
  font-size: 11px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-add {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 0;
  min-width: 0;
}
.add-input {
  width: 220px;
  max-width: 100%;
}
.add-hint {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.available-card :deep(.ant-card-head) {
  flex-wrap: wrap;
  gap: 8px;
}
.search-input {
  width: 220px;
  max-width: 100%;
}
@media (max-width: 640px) {
  .search-input,
  .add-input {
    width: 100%;
  }
  .role-add {
    flex-direction: column;
    align-items: stretch;
  }
}
.card-title {
  font-weight: 600;
}
.card-subtitle {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 8px;
}
.model-table {
  min-width: 0;
}
.cell-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.cell-selector {
  font-size: 11px;
  color: #8c8c8c;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.cell-provider {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell-thinking {
  font-size: 11px;
  display: inline-block;
  max-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.cell-actions {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  align-items: center;
}
.action-btn {
  padding: 0 6px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.table-foot {
  font-size: 11px;
  margin-top: 8px;
  display: block;
  white-space: normal;
  word-break: break-word;
}
.roles-foot code {
  background: #f5f5f5;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
}
.foot-text {
  font-size: 12px;
  word-break: break-word;
}
.hide-sm {
}
@media (max-width: 760px) {
  .role-grid {
    grid-template-columns: 1fr;
  }
  .thinking-field {
    grid-template-columns: 36px 1fr;
  }
  .thinking-field .field-hint {
    display: none;
  }
  .hide-sm {
    display: none;
  }
  .roles-tip :deep(.ant-alert-message) {
    white-space: normal;
  }
}
</style>
