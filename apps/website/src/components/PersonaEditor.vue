<script setup lang="ts">
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "@lucide/vue";
import { message } from "antdv-next";
import { reactive, ref } from "vue";

/**
 * Edits the custom entries of settings.json → `roles` (OMP roleSchema: id/name/label/
 * description/prompt/icon/accent). Selecting the active persona stays in OmpRoleSelector;
 * this only maintains the list. Changes go to the parent, the top-bar save persists them.
 */
export interface EditableRole {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  prompt?: string;
  icon?: string;
  accent?: string;
}

const props = defineProps<{ roles: EditableRole[] }>();
const emit = defineEmits<{ change: [roles: EditableRole[]] }>();

const editingId = ref("");
const creating = ref(false);
const draft = reactive<Required<Pick<EditableRole, "id" | "icon" | "accent">> & EditableRole>({
  id: "",
  label: "",
  description: "",
  prompt: "",
  icon: "🎭",
  accent: "#1677ff",
});

function startCreate() {
  creating.value = true;
  editingId.value = "";
  Object.assign(draft, {
    id: "",
    label: "",
    description: "",
    prompt: "",
    icon: "🎭",
    accent: "#1677ff",
  });
}

function startEdit(role: EditableRole) {
  creating.value = false;
  editingId.value = role.id;
  Object.assign(draft, {
    id: role.id,
    label: role.label ?? role.name ?? "",
    description: role.description ?? "",
    prompt: role.prompt ?? "",
    icon: role.icon ?? "🎭",
    accent: role.accent ?? "#1677ff",
  });
}

function cancelEdit() {
  creating.value = false;
  editingId.value = "";
}

function submit() {
  const id = draft.id
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/g, "");
  if (!id) {
    message.warning("角色 id 必填（字母、数字、_ 或 -）");
    return;
  }
  const clash = props.roles.some((role) => role.id === id && role.id !== editingId.value);
  if (clash) {
    message.warning(`角色 id「${id}」已存在`);
    return;
  }
  const entry: EditableRole = {
    id,
    label: draft.label?.trim() || undefined,
    description: draft.description?.trim() || undefined,
    prompt: draft.prompt?.trim() || undefined,
    icon: draft.icon?.trim() || undefined,
    accent: draft.accent || undefined,
  };
  if (creating.value) emit("change", [...props.roles, entry]);
  else
    emit(
      "change",
      props.roles.map((role) => (role.id === editingId.value ? entry : role)),
    );
  cancelEdit();
  message.success(
    creating.value ? "已添加，点右上角「保存」写入配置" : "已更新，点右上角「保存」写入配置",
  );
}

function removeRole(role: EditableRole) {
  emit(
    "change",
    props.roles.filter((item) => item.id !== role.id),
  );
  if (editingId.value === role.id) cancelEdit();
}
</script>

<template>
  <div class="persona-editor">
    <div v-if="roles.length" class="role-list">
      <div v-for="role in roles" :key="role.id" class="role-row">
        <span class="role-icon" :style="{ background: role.accent ?? '#8c8c8c' }">{{
          role.icon ?? "🎭"
        }}</span>
        <div class="role-text">
          <a-typography-text strong>{{ role.label ?? role.name ?? role.id }}</a-typography-text>
          <a-typography-text type="secondary" class="role-desc">{{
            role.description || role.id
          }}</a-typography-text>
        </div>
        <a-space :size="0">
          <a-tooltip title="编辑"
            ><a-button type="text" size="small" @click="startEdit(role)"
              ><Pencil :size="14" /></a-button
          ></a-tooltip>
          <a-popconfirm
            title="删除这个自定义人格？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="removeRole(role)"
            ><a-button type="text" danger size="small"><Trash2 :size="14" /></a-button
          ></a-popconfirm>
        </a-space>
      </div>
    </div>
    <a-empty v-else :image="null" description="还没有自定义人格，可以新建一个" />

    <div class="editor-form">
      <a-button
        v-if="!creating && editingId === ''"
        type="primary"
        ghost
        size="small"
        @click="startCreate"
        ><Plus :size="14" />新建人格</a-button
      >
      <template v-else>
        <a-row :gutter="12">
          <a-col :span="6"
            ><a-form-item label="角色 id" required
              ><a-input
                v-model:value="draft.id"
                placeholder="my-role"
                :disabled="!creating" /></a-form-item
          ></a-col>
          <a-col :span="6"
            ><a-form-item label="名称"
              ><a-input v-model:value="draft.label" placeholder="我的角色" /></a-form-item
          ></a-col>
          <a-col :span="5"
            ><a-form-item label="图标"
              ><a-input v-model:value="draft.icon" placeholder="🎭" :maxlength="4" /></a-form-item
          ></a-col>
          <a-col :span="7"
            ><a-form-item label="强调色"
              ><a-input
                v-model:value="draft.accent"
                type="color"
                class="color-input" /></a-form-item
          ></a-col>
          <a-col :span="24"
            ><a-form-item label="一句话描述"
              ><a-input
                v-model:value="draft.description"
                placeholder="显示在角色卡片上" /></a-form-item
          ></a-col>
          <a-col :span="24"
            ><a-form-item label="System Prompt"
              ><a-textarea
                v-model:value="draft.prompt"
                placeholder="该人格使用的系统提示词，会写入 roles[].prompt"
                :auto-size="{ minRows: 3, maxRows: 10 }" /></a-form-item
          ></a-col>
        </a-row>
        <a-space>
          <a-button type="primary" size="small" @click="submit"><Check :size="14" />确定</a-button>
          <a-button size="small" @click="cancelEdit"><RotateCcw :size="14" />取消</a-button>
        </a-space>
      </template>
    </div>
  </div>
</template>

<style scoped>
.persona-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.role-list {
  display: flex;
  flex-direction: column;
}
.role-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #f5f5f5;
}
.role-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.role-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.role-desc {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.editor-form {
  border-top: 1px dashed #e8e8e8;
  padding-top: 12px;
}
</style>
