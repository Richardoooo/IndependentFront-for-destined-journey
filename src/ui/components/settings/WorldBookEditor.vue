<template>
  <div class="worldbook-editor">
    <div class="editor-header">
      <button class="back-btn" type="button" @click.stop="$emit('back')" aria-label="返回世界书列表">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        <span>返回列表</span>
      </button>
      <h3>{{ book.name }} · 条目管理</h3>
      <button v-if="!readonly" class="add-btn" @click="addEntry">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        <span>新建条目</span>
      </button>
      <span v-else class="builtin-notice"><i class="fa-solid fa-lock" aria-hidden="true"></i> 内置世界书 · 只读</span>
    </div>

    <!-- 空状态 -->
    <div v-if="sortedEntries.length === 0" class="empty-state">
      <i class="fa-solid fa-book-open empty-icon" aria-hidden="true"></i>
      <p class="empty-title">暂无条目</p>
      <p class="empty-desc">点击「新建条目」开始添加世界书内容</p>
      <button class="add-btn" @click="addEntry">新建条目</button>
    </div>

    <!-- 条目表格 -->
    <div v-else class="entry-table">
      <div class="entry-row entry-header">
        <span class="col-num">#</span>
        <span class="col-name">名称</span>
        <span class="col-toggle">启用</span>
        <span class="col-toggle">永久</span>
        <span class="col-order">排序</span>
        <span class="col-actions">操作</span>
      </div>

      <div
        v-for="(entry, idx) in sortedEntries"
        :key="entry.uid"
        class="entry-row"
        :class="{ disabled: !entry.enabled }"
        :tabindex="0"
        @keydown.enter="editEntry(idx)"
      >
        <span class="col-num">{{ idx + 1 }}</span>
        <span class="col-name" :title="entry.name" role="button" tabindex="0">
          {{ entry.name || '(未命名)' }}
        </span>
        <label class="col-toggle toggle-label-inline" :title="entry.enabled ? '已启用' : '已禁用'">
          <input type="checkbox" v-model="entry.enabled" @change="onToggleChange" :aria-label="`启用 ${entry.name}`" />
          <span class="toggle-slider-sm"></span>
        </label>
        <label class="col-toggle toggle-label-inline" :title="entry.constant ? '永久注入中' : '关键词触发'">
          <input type="checkbox" v-model="entry.constant" @change="onToggleChange" :aria-label="`${entry.name} 永久注入`" />
          <span class="toggle-slider-sm"></span>
        </label>
        <span class="col-order">
          <button class="order-btn" @click="moveUp(idx)" :disabled="readonly || idx === 0" aria-label="上移">
            <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
          </button>
          <input type="number" v-model.number="entry.order" :disabled="readonly" @change="markDirty" class="order-input" :aria-label="`${entry.name} 排序`" />
          <button class="order-btn" @click="moveDown(idx)" :disabled="readonly || idx === sortedEntries.length - 1" aria-label="下移">
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </span>
        <span class="col-actions">
          <button class="icon-btn" @click="editEntry(idx)" :aria-label="`编辑 ${entry.name}`">
            <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
          </button>
          <button v-if="!readonly" class="icon-btn danger" @click="deleteEntry(idx)" :aria-label="`删除 ${entry.name}`">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </span>
      </div>
    </div>

    <!-- 条目编辑弹窗 -->
    <div v-if="editingIndex !== null" class="modal-overlay" @click.self="cancelEdit" @keydown.escape="cancelEdit">
      <div class="edit-modal" role="dialog" aria-modal="true" aria-label="编辑条目">
        <h4>{{ readonly ? '查看条目' : '编辑条目' }}</h4>

        <label class="form-label" for="edit-name">名称</label>
        <input id="edit-name" ref="editNameInput" v-model="editForm.name" class="form-input" placeholder="条目名称" :disabled="readonly" :readonly="readonly" />

        <label class="form-label" for="edit-keys">关键词（逗号分隔）</label>
        <input id="edit-keys" v-model="editForm.keys" class="form-input" placeholder="阿斯塔利亚, 虚海" :disabled="readonly" :readonly="readonly" />

        <label class="form-label" for="edit-keysecondary">辅助关键词</label>
        <input id="edit-keysecondary" v-model="editForm.keysecondary" class="form-input" placeholder="世界设定" :disabled="readonly" :readonly="readonly" />

        <div class="edit-row">
          <label class="form-label">逻辑
            <select v-model.number="editForm.selectiveLogic" class="form-input" aria-label="关键词匹配逻辑" :disabled="readonly">
              <option :value="0">AND_ANY — 命中任一辅助关键词</option>
              <option :value="1">NOT_ALL — 未命中所有辅助关键词</option>
              <option :value="2">NOT_ANY — 未命中任何辅助关键词</option>
              <option :value="3">AND_ALL — 命中所有辅助关键词</option>
            </select>
          </label>

          <label class="form-label checkbox-label">
            <input type="checkbox" v-model="editForm.constant" :disabled="readonly" />
            <span>永久注入</span>
          </label>

          <label class="form-label" for="edit-order">排序
            <input id="edit-order" type="number" v-model.number="editForm.order" class="form-input order-input-sm" :disabled="readonly" :readonly="readonly" />
          </label>
        </div>

        <label class="form-label" for="edit-content">内容 (Markdown)</label>
        <textarea id="edit-content" v-model="editForm.content" class="form-textarea" rows="12" :disabled="readonly" :readonly="readonly"></textarea>

        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelEdit">{{ readonly ? '关闭' : '取消' }}</button>
          <button v-if="!readonly" class="btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { WorldBook, WorldBookEntry } from '@engine/types'

const editNameInput = ref<HTMLInputElement | null>(null)

const props = defineProps<{
  book: WorldBook
  readonly?: boolean
}>()

const emit = defineEmits<{
  back: []
  update: [book: WorldBook]
}>()

// ===== State =====

const entries = ref<WorldBookEntry[]>(
  JSON.parse(JSON.stringify(props.book.entries))
)

const editingIndex = ref<number | null>(null)
const editForm = ref({
  name: '',
  keys: '',
  keysecondary: '',
  selectiveLogic: 0 as number,
  constant: false,
  order: 100,
  content: '',
})

// ===== Computed =====

const sortedEntries = computed(() => {
  return [...entries.value].sort((a, b) => a.order - b.order)
})

// ===== Methods =====

function markDirty() {
  // automatic save via watch
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function onToggleChange() {
  if (!props.book.builtIn) return

  // 内置书：直接写回本地 JSON 文件
  const updatedBook = { ...props.book, entries: entries.value }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fetch(`/api/worldbooks/${props.book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedBook),
    }).catch(() => {})
  }, 600)
}

function addEntry() {
  const newEntry: WorldBookEntry = {
    uid: Date.now(),
    name: '新条目',
    content: '',
    enabled: true,
    constant: false,
    key: [],
    keysecondary: [],
    selectiveLogic: 0,
    order: entries.value.length > 0
      ? Math.max(...entries.value.map(e => e.order)) + 10
      : 100,
    position: 0,
  }
  entries.value.push(newEntry)
  saveBook()
}

async function editEntry(idx: number) {
  const entry = sortedEntries.value[idx]
  editingIndex.value = idx
  editForm.value = {
    name: entry.name,
    keys: entry.key.join(', '),
    keysecondary: entry.keysecondary.join(', '),
    selectiveLogic: entry.selectiveLogic,
    constant: entry.constant,
    order: entry.order,
    content: entry.content,
  }
  await nextTick()
  editNameInput.value?.focus()
}

function saveEdit() {
  if (editingIndex.value !== null) {
    const entry = sortedEntries.value[editingIndex.value]
    entry.name = editForm.value.name
    entry.key = editForm.value.keys.split(',').map(k => k.trim()).filter(Boolean)
    entry.keysecondary = editForm.value.keysecondary.split(',').map(k => k.trim()).filter(Boolean)
    entry.selectiveLogic = editForm.value.selectiveLogic
    entry.constant = editForm.value.constant
    entry.order = editForm.value.order
    entry.content = editForm.value.content
    saveBook()
  }
  editingIndex.value = null
}

function cancelEdit() {
  editingIndex.value = null
}

function deleteEntry(idx: number) {
  if (!confirm('确定删除此条目？')) return
  const entry = sortedEntries.value[idx]
  const realIdx = entries.value.findIndex(e => e.uid === entry.uid)
  if (realIdx >= 0) {
    entries.value.splice(realIdx, 1)
    saveBook()
  }
}

function moveUp(idx: number) {
  if (idx === 0) return
  const a = sortedEntries.value[idx - 1]
  const b = sortedEntries.value[idx]
  const tmp = a.order
  a.order = b.order
  b.order = tmp
  saveBook()
}

function moveDown(idx: number) {
  if (idx >= sortedEntries.value.length - 1) return
  const a = sortedEntries.value[idx]
  const b = sortedEntries.value[idx + 1]
  const tmp = a.order
  a.order = b.order
  b.order = tmp
  saveBook()
}

function saveBook() {
  emit('update', {
    ...props.book,
    entries: entries.value,
  })
}

// Sync with external book changes
watch(() => props.book, (newBook) => {
  entries.value = JSON.parse(JSON.stringify(newBook.entries))
}, { deep: true })
</script>

<style scoped>
.worldbook-editor {
  max-width: 900px;
}

/* ===== Container ===== */
.worldbook-editor {
  background: rgba(128,128,128,0.06);
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: var(--theme-radius-lg);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* ===== Header ===== */
.editor-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.18);
}

.editor-header h3 {
  flex: 1;
  margin: 0;
  font-size: 16px;
}

.back-btn, .add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--theme-radius-sm);
  background: rgba(128,128,128,0.06);
  color: var(--theme-text);
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;
  transition: background 0.15s, transform 0.1s;
}

.back-btn:hover, .add-btn:hover {
  filter: brightness(0.95);
}

.back-btn:active, .add-btn:active {
  transform: scale(0.97);
}

.add-btn {
  background: var(--theme-color-primary, #15803D);
  color: white;
  border-color: transparent;
}

/* ===== Empty State ===== */
.empty-state {
  text-align: center;
  padding: 48px 16px;
  border: 2px dashed rgba(255,255,255,0.18);
  border-radius: var(--theme-radius-md);
}

.empty-icon {
  font-size: 40px;
  color: var(--theme-text-secondary);
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 14px;
  color: var(--theme-text-secondary);
  margin: 0 0 16px;
}

/* ===== Table ===== */
.entry-table {
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
  background: var(--theme-surface);
}

.entry-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.18);
  gap: 8px;
  font-size: 14px;
  transition: background 0.12s;
}

.entry-row:nth-child(even):not(.entry-header) {
  background: rgba(128, 128, 128, 0.03);
}

.entry-row:hover {
  background: var(--theme-hover, rgba(128, 128, 128, 0.08)) !important;
}

.entry-row:last-child {
  border-bottom: none;
}

.entry-row.entry-header {
  background: rgba(128,128,128,0.06);
  font-weight: 600;
  font-size: 13px;
  text-transform: none;
  letter-spacing: 0;
  color: var(--theme-text-secondary);
  border-bottom: 2px solid rgba(255,255,255,0.18);
}

.entry-row.disabled {
  opacity: 0.45;
  text-decoration: line-through;
}

.entry-row.disabled:hover {
  background: transparent !important;
}

.col-num {
  width: 32px;
  text-align: center;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.col-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  color: var(--theme-color-primary, #15803D);
  font-weight: 500;
}

.col-toggle {
  width: 56px;
  text-align: center;
}

.col-order {
  width: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.col-actions {
  width: 80px;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 4px;
}

/* ===== Toggle Slider (inline, small) ===== */
.toggle-label-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
  position: relative;
}

.toggle-label-inline input[type="checkbox"] {
  position: absolute;
  width: 36px;
  height: 22px;
  opacity: 0;
  cursor: pointer;
}

.toggle-slider-sm {
  display: inline-block;
  width: 36px;
  height: 22px;
  background: rgba(255,255,255,0.18);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
}

.toggle-slider-sm::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-label-inline input:checked + .toggle-slider-sm {
  background: var(--theme-color-primary, #15803D);
}

.toggle-label-inline input:checked + .toggle-slider-sm::after {
  transform: translateX(14px);
}

.toggle-label-inline input:focus-visible + .toggle-slider-sm {
  outline: 2px solid rgba(34,197,94,0.6);
  outline-offset: 2px;
}

/* ===== Order ===== */
.order-input {
  width: 54px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--theme-radius-sm);
  padding: 4px 6px;
  font-size: 14px;
  background: rgba(128,128,128,0.06);
  color: var(--theme-text);
  min-height: 32px;
}

.order-input:focus {
  outline: 2px solid rgba(34,197,94,0.6);
  outline-offset: -1px;
}

.order-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--theme-radius-sm);
  background: rgba(128,128,128,0.06);
  cursor: pointer;
  color: var(--theme-text-secondary);
  font-size: 12px;
  transition: background 0.15s, color 0.15s;
}

.order-btn:hover:not(:disabled) {
  background: var(--theme-hover, rgba(255,255,255,0.1));
  color: var(--theme-text);
}

.order-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

/* ===== Icon buttons ===== */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border: none;
  border-radius: var(--theme-radius-sm);
  background: transparent;
  cursor: pointer;
  color: var(--theme-text-secondary);
  font-size: 14px;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}

.icon-btn:hover {
  background: var(--theme-hover, rgba(255,255,255,0.08));
  color: var(--theme-text);
}

.icon-btn:active {
  transform: scale(0.9);
}

.icon-btn:focus-visible {
  outline: 2px solid rgba(34,197,94,0.6);
  outline-offset: 2px;
}

.icon-btn.danger:hover {
  background: rgba(220, 38, 38, 0.15);
  color: #ef4444;
}

/* ===== Edit Modal ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.edit-modal {
  background: #1a2035;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--theme-radius-lg);
  padding: 24px;
  width: min(640px, calc(100vw - 32px));
  max-height: 85vh;
  max-height: 85dvh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.edit-modal h4 {
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 18px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
}

.edit-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 0;
}

.edit-modal .checkbox-label,
.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-height: 44px;
  font-size: 14px;
  color: rgba(255,255,255,0.75);
  margin-top: 14px;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #22c55e;
}

.order-input-sm {
  width: 72px;
  text-align: center;
}

/* ===== 表单输入框 ===== */
.edit-modal .form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  margin-bottom: 4px;
  margin-top: 14px;
}

.edit-modal .form-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}

.edit-modal .form-input:focus {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(255,255,255,0.07);
}

.edit-modal .form-input::placeholder {
  color: rgba(255,255,255,0.2);
}

.edit-modal select.form-input {
  cursor: pointer;
  padding-right: 30px;
}

.form-textarea {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, 'JetBrains Mono', 'Consolas', monospace;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.9);
  resize: vertical;
  min-height: 200px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}

.form-textarea:focus {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(255,255,255,0.07);
}

.form-textarea::placeholder {
  color: rgba(255,255,255,0.2);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  min-height: 44px;
  transition: background 0.15s;
}

.btn-primary {
  background: #22c55e;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #16a34a;
}

.btn-secondary {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1);
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.1);
}

/* ===== 内置只读 ===== */
.builtin-notice {
  font-size: 13px;
  color: rgba(255,255,255,0.4);
  display: flex;
  align-items: center;
  gap: 6px;
}
input:disabled, .order-btn:disabled, .icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== Focus visible ===== */
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid rgba(34,197,94,0.6);
  outline-offset: 2px;
}
</style>
