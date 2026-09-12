<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChatDotRound, Delete, MoreFilled, Plus, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import { fetchWarehouseStatus } from '../../api/warehouseStatus'
import DemoWarehouseBanner from '../common/DemoWarehouseBanner.vue'
import SettingsDialog from './SettingsDialog.vue'
import SidebarFooter from './SidebarFooter.vue'
import {
  STALE_WAREHOUSE_SESSION_MESSAGE,
  STALE_WAREHOUSE_SIDEBAR_BADGE,
  isSessionWarehouseStale,
} from '../../lib/sessionWarehouse'
import { useAuthStore } from '../../stores/auth'
import { useSessionsStore, type SessionMeta } from '../../stores/sessions'

/** Groups sessions into 今天/昨天/更早 buckets by `updatedAt`, newest first within each. */
function groupByDay(list: SessionMeta[]): { label: string; sessions: SessionMeta[] }[] {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000

  const today: SessionMeta[] = []
  const yesterday: SessionMeta[] = []
  const earlier: SessionMeta[] = []
  for (const s of list) {
    if (s.updatedAt >= todayMs) today.push(s)
    else if (s.updatedAt >= yesterdayMs) yesterday.push(s)
    else earlier.push(s)
  }

  return [
    { label: '今天', sessions: today },
    { label: '昨天', sessions: yesterday },
    { label: '更早', sessions: earlier },
  ].filter((g) => g.sessions.length > 0)
}

const route = useRoute()
const router = useRouter()
const sessionsStore = useSessionsStore()
const auth = useAuthStore()

const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
function matchesQuery(s: SessionMeta): boolean {
  return !normalizedQuery.value || s.title.toLowerCase().includes(normalizedQuery.value)
}

/** `undefined` until `/api/warehouse/status` resolves; then mirrors `active_connection_id`. */
const activeWarehouseId = ref<string | null | undefined>(undefined)

async function refreshWarehouseStatus() {
  if (!auth.isAuthenticated) {
    activeWarehouseId.value = undefined
    return
  }
  try {
    const status = await fetchWarehouseStatus()
    activeWarehouseId.value = status.active_connection_id
  } catch {
    // Soft-fail: keep previous known id so we do not flash false positives.
  }
}

function onFocus() {
  void refreshWarehouseStatus()
}

function onVisibility() {
  if (document.visibilityState === 'visible') void refreshWarehouseStatus()
}

onMounted(() => {
  void refreshWarehouseStatus()
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(
  () => auth.isAuthenticated,
  () => {
    void refreshWarehouseStatus()
  },
)

function sessionIsStale(s: SessionMeta) {
  return isSessionWarehouseStale(s.warehouseConnectionId, activeWarehouseId.value)
}

const staleBadge = STALE_WAREHOUSE_SIDEBAR_BADGE
const staleMessage = STALE_WAREHOUSE_SESSION_MESSAGE

const activeSessions = computed(() => sessionsStore.sessions.filter((s) => !s.archived && matchesQuery(s)))
const archivedSessions = computed(() => sessionsStore.sessions.filter((s) => s.archived && matchesQuery(s)))
const groupedActiveSessions = computed(() => groupByDay(activeSessions.value))

function newChat() {
  const id = crypto.randomUUID()
  sessionsStore.ensure(id)
  void router.push({ name: 'chat-session', params: { sessionId: id } })
}

function openSession(id: string) {
  void router.push({ name: 'chat-session', params: { sessionId: id } })
}

function onSessionCommand(command: string) {
  const [action, id] = command.split(':', 2) as [string, string]
  if (action === 'archive') sessionsStore.archive(id)
  else if (action === 'unarchive') sessionsStore.unarchive(id)
  else if (action === 'delete') confirmDelete(id)
}

async function confirmDelete(id: string) {
  try {
    await ElMessageBox.confirm('删除后该会话的对话历史将无法恢复，确认删除吗？', '删除会话', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const deletingCurrent = route.params.sessionId === id
  sessionsStore.remove(id)
  if (deletingCurrent) newChat()
}
</script>

<template>
  <div class="h-screen flex overflow-hidden bg-[var(--color-background)]">
    <DemoWarehouseBanner />
    <aside
      class="w-64 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <div class="p-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-2.5 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm"
            aria-hidden="true"
          >
            <el-icon :size="18"><ChatDotRound /></el-icon>
          </div>
          <div class="min-w-0">
            <div class="text-base font-semibold tracking-tight text-[var(--color-foreground)]">
              OpenChatBI
            </div>
            <div class="text-xs text-[var(--color-muted-foreground)]">智能数据分析对话</div>
          </div>
        </div>
        <el-button type="primary" class="w-full !h-10 !rounded-xl" @click="newChat">
          <el-icon class="mr-1"><Plus /></el-icon>
          新建会话
        </el-button>
        <el-input
          v-model="query"
          placeholder="搜索会话"
          aria-label="搜索会话"
          class="ocbi-session-search mt-2"
          :prefix-icon="Search"
        />
      </div>

      <nav class="flex-1 overflow-y-auto p-2" aria-label="会话列表">
        <div
          v-if="activeSessions.length === 0"
          class="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]"
        >
          {{ query ? '没有匹配的会话' : '暂无会话，点击上方开始' }}
        </div>
        <div v-for="group in groupedActiveSessions" :key="group.label" class="mb-1">
          <div class="px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-muted-foreground)]">
            {{ group.label }}
          </div>
          <div
            v-for="s in group.sessions"
            :key="s.id"
            class="mb-0.5 flex items-center gap-1"
            :class="sessionIsStale(s) ? 'opacity-70' : ''"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200"
              :class="[
                sessionIsStale(s)
                  ? 'text-[var(--color-muted-foreground)]'
                  : route.params.sessionId === s.id
                    ? 'font-medium text-[var(--color-primary)]'
                    : 'text-slate-600',
                route.params.sessionId === s.id
                  ? 'bg-[var(--color-muted)] shadow-[inset_3px_0_0_0_var(--color-primary)]'
                  : 'hover:bg-slate-50',
              ]"
              :title="sessionIsStale(s) ? staleMessage : undefined"
              :aria-label="sessionIsStale(s) ? `${s.title}（${staleBadge}）` : undefined"
              @click="openSession(s.id)"
            >
              <span class="truncate">{{ s.title }}</span>
              <el-tag
                v-if="sessionIsStale(s)"
                size="small"
                type="warning"
                effect="light"
                round
                class="!ml-auto shrink-0 !border-amber-200 !bg-amber-50 !text-[10px] !text-amber-800"
              >
                {{ staleBadge }}
              </el-tag>
            </button>
            <el-dropdown trigger="click" @command="onSessionCommand">
              <button
                type="button"
                aria-label="会话操作"
                class="shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-slate-100"
              >
                <el-icon :size="16"><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="`archive:${s.id}`">归档</el-dropdown-item>
                  <el-dropdown-item :command="`delete:${s.id}`" divided class="!text-red-600">
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <el-collapse v-if="archivedSessions.length > 0" class="ocbi-archive-collapse mt-2">
          <el-collapse-item :title="`已归档（${archivedSessions.length}）`" name="archived">
            <div
              v-for="s in archivedSessions"
              :key="s.id"
              class="flex min-w-0 items-center gap-1 rounded-lg px-3 py-2 text-sm"
              :class="[
                sessionIsStale(s) ? 'text-[var(--color-muted-foreground)] opacity-70' : 'text-slate-500',
                route.params.sessionId === s.id ? 'bg-[var(--color-muted)]' : 'hover:bg-slate-50',
              ]"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 truncate text-left"
                :title="sessionIsStale(s) ? staleMessage : undefined"
                :aria-label="sessionIsStale(s) ? `${s.title}（${staleBadge}）` : undefined"
                @click="openSession(s.id)"
              >
                <span class="truncate">{{ s.title }}</span>
                <el-tag
                  v-if="sessionIsStale(s)"
                  size="small"
                  type="warning"
                  effect="light"
                  round
                  class="!ml-auto shrink-0 !border-amber-200 !bg-amber-50 !text-[10px] !text-amber-800"
                >
                  {{ staleBadge }}
                </el-tag>
              </button>
              <button
                type="button"
                aria-label="恢复会话"
                title="恢复"
                class="shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-slate-100"
                @click="sessionsStore.unarchive(s.id)"
              >
                <el-icon :size="14"><RefreshLeft /></el-icon>
              </button>
              <button
                type="button"
                aria-label="删除会话"
                title="删除"
                class="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50"
                @click="confirmDelete(s.id)"
              >
                <el-icon :size="14"><Delete /></el-icon>
              </button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </nav>

      <SidebarFooter />
    </aside>

    <section class="flex min-h-0 min-w-0 flex-1 flex-col">
      <slot />
    </section>

    <SettingsDialog />
  </div>
</template>

<style scoped>
.ocbi-archive-collapse :deep(.el-collapse-item__header) {
  border: none;
  height: auto;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: transparent;
}

.ocbi-archive-collapse :deep(.el-collapse-item__wrap),
.ocbi-archive-collapse :deep(.el-collapse-item__content) {
  border: none;
  padding: 0;
}

.ocbi-archive-collapse {
  border: none;
  border-top: 1px solid var(--color-border);
  padding-top: 0.25rem;
}

.ocbi-session-search :deep(.el-input__wrapper) {
  background: var(--color-muted);
  box-shadow: none;
  border-radius: 0.5rem;
}
</style>
