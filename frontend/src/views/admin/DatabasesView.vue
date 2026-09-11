<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Plus } from '@element-plus/icons-vue'

import AppShell from '../../components/layout/AppShell.vue'
import {
  activateDatabaseConnection,
  createDatabaseConnection,
  deleteDatabaseConnection,
  fetchDatabaseConnections,
  testDatabaseConnectionDraft,
  testExistingDatabaseConnection,
  updateDatabaseConnection,
  type ConnectionRuntimeApplyStatus,
  type DatabaseConnection,
  type DatabaseConnectionInput,
  type DialectCatalogItem,
} from '../../api/databaseConnections'

type FormState = {
  name: string
  dialect: string
  host: string
  port: string
  database: string
  username: string
  password: string
  uri_override: string
  catalog_database_name: string
  token_service_url: string
  token_username: string
  token_password: string
}

function emptyForm(): FormState {
  return {
    name: '',
    dialect: 'mysql',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    uri_override: '',
    catalog_database_name: '',
    token_service_url: '',
    token_username: '',
    token_password: '',
  }
}

const loading = ref(false)
const rows = ref<DatabaseConnection[]>([])
const catalog = ref<DialectCatalogItem[]>([])

const dialogOpen = ref(false)
const editing = ref<DatabaseConnection | null>(null)
const form = reactive<FormState>(emptyForm())
const showAdvanced = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; detail: string } | null>(null)
const activatingId = ref<string | null>(null)

const dialectMeta = computed(() => catalog.value.find((d) => d.id === form.dialect) ?? null)

function dialectLabel(dialect: string): string {
  return catalog.value.find((d) => d.id === dialect)?.label ?? dialect
}

function connectionSummary(row: DatabaseConnection): string {
  if (row.has_uri_override) return '自定义连接串'
  const parts = [row.host, row.port ? `:${row.port}` : '', row.database ? `/${row.database}` : '']
  return parts.join('') || '—'
}

async function refresh() {
  loading.value = true
  try {
    const res = await fetchDatabaseConnections()
    rows.value = res.connections
    catalog.value = res.catalog
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})

function openCreateDialog() {
  editing.value = null
  Object.assign(form, emptyForm())
  showAdvanced.value = false
  testResult.value = null
  dialogOpen.value = true
}

function openEditDialog(row: DatabaseConnection) {
  editing.value = row
  Object.assign(form, {
    name: row.name,
    dialect: row.dialect,
    host: row.host ?? '',
    port: row.port ? String(row.port) : '',
    database: row.database ?? '',
    username: row.username ?? '',
    password: '',
    uri_override: '',
    catalog_database_name: row.catalog_database_name ?? '',
    token_service_url: row.token_service_url ?? '',
    token_username: row.token_username ?? '',
    token_password: '',
  })
  showAdvanced.value = Boolean(row.has_uri_override || row.token_service_url)
  testResult.value = null
  dialogOpen.value = true
}

function buildPayload(): DatabaseConnectionInput {
  return {
    name: form.name.trim(),
    dialect: form.dialect,
    host: form.host.trim() || null,
    port: form.port.trim() ? Number(form.port.trim()) : null,
    database: form.database.trim() || null,
    username: form.username.trim() || null,
    password: form.password || undefined,
    uri_override: form.uri_override.trim() || null,
    catalog_database_name: form.catalog_database_name.trim() || null,
    token_service_url: form.token_service_url.trim() || null,
    token_username: form.token_username.trim() || null,
    token_password: form.token_password || undefined,
  }
}

async function onTest() {
  testing.value = true
  testResult.value = null
  try {
    const hasNewSecret = Boolean(form.password || form.token_password)
    const result =
      editing.value && !hasNewSecret
        ? await testExistingDatabaseConnection(editing.value.id)
        : await testDatabaseConnectionDraft(buildPayload())
    testResult.value = result
  } catch (e) {
    testResult.value = { ok: false, detail: e instanceof Error ? e.message : '测试失败' }
  } finally {
    testing.value = false
  }
}

async function onSave() {
  saving.value = true
  try {
    if (editing.value) {
      await updateDatabaseConnection(editing.value.id, buildPayload())
    } else {
      await createDatabaseConnection(buildPayload())
    }
    ElMessage.success('已保存')
    dialogOpen.value = false
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function runtimeApplyMessage(status: ConnectionRuntimeApplyStatus): { type: 'success' | 'warning'; text: string } {
  if (status.catalog_sync_status === 'failed') {
    return {
      type: 'warning',
      text: '同步失败，激活已回滚，请检查连接后重试',
    }
  }
  if (status.index_reload_status === 'failed') {
    return {
      type: 'warning',
      text: '索引重建失败：catalog 已更新，但检索索引重建失败——问数可能不准',
    }
  }
  if (status.catalog_sync_status === 'success' && status.index_reload_status === 'success') {
    return { type: 'success', text: '成功：数仓已激活，catalog 已同步并重建索引' }
  }
  return { type: 'success', text: '数仓已激活' }
}

async function onActivate(row: DatabaseConnection) {
  activatingId.value = row.id
  try {
    const updated = await activateDatabaseConnection(row.id)
    const notice = updated.runtime_apply ? runtimeApplyMessage(updated.runtime_apply) : null
    if (notice?.type === 'warning') {
      ElMessage.warning(notice.text)
    } else {
      ElMessage.success(notice?.text ?? `已切换为「${row.name}」`)
    }
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '切换失败')
  } finally {
    activatingId.value = null
  }
}

async function onDelete(row: DatabaseConnection) {
  try {
    await deleteDatabaseConnection(row.id)
    ElMessage.success('已删除')
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

const canSave = computed(() => form.name.trim().length > 0 && form.dialect.length > 0)
</script>

<template>
  <AppShell>
    <div class="flex-1 overflow-auto bg-[var(--color-background)] p-6">
      <div class="mx-auto max-w-5xl">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-primary)]"
              aria-hidden="true"
            >
              <el-icon :size="20"><Connection /></el-icon>
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
                数据库连接管理
              </h1>
              <p class="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                配置用于问答的数据仓库连接，支持随时切换当前使用的数据库
              </p>
            </div>
          </div>
          <el-button type="primary" class="!h-10 !rounded-xl" @click="openCreateDialog">
            <el-icon class="mr-1"><Plus /></el-icon>
            添加数据库连接
          </el-button>
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]"
        >
          <el-table v-loading="loading" :data="rows" stripe class="db-table">
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="类型" width="120">
              <template #default="{ row }">{{ dialectLabel(row.dialect) }}</template>
            </el-table-column>
            <el-table-column label="连接地址" min-width="200">
              <template #default="{ row }">
                <span class="text-sm text-slate-500">{{ connectionSummary(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" effect="light" round>
                  {{ row.is_active ? '当前使用' : '未启用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="right">
              <template #default="{ row }">
                <el-button
                  v-if="!row.is_active"
                  size="small"
                  link
                  type="primary"
                  :loading="activatingId === row.id"
                  @click="onActivate(row)"
                >
                  设为当前
                </el-button>
                <el-button size="small" link type="primary" @click="openEditDialog(row)">编辑</el-button>
                <el-button
                  size="small"
                  link
                  type="danger"
                  :disabled="row.is_active"
                  :title="row.is_active ? '请先切换到其他数据库再删除' : undefined"
                  @click="onDelete(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <el-dialog v-model="dialogOpen" :title="editing ? '编辑数据库连接' : '添加数据库连接'" width="520px" class="rounded-2xl">
        <el-form label-position="top">
          <el-form-item label="连接名称">
            <el-input v-model="form.name" placeholder="例如：生产环境 MySQL" />
          </el-form-item>
          <el-form-item label="数据库类型">
            <el-select v-model="form.dialect" class="w-full">
              <el-option v-for="d in catalog" :key="d.id" :label="d.label" :value="d.id" />
            </el-select>
          </el-form-item>

          <div v-if="dialectMeta?.requires_host" class="flex gap-3">
            <el-form-item label="主机地址" class="flex-[2]">
              <el-input v-model="form.host" placeholder="host.example.com" />
            </el-form-item>
            <el-form-item label="端口" class="flex-1">
              <el-input v-model="form.port" :placeholder="dialectMeta.default_port ? String(dialectMeta.default_port) : ''" />
            </el-form-item>
          </div>

          <el-form-item v-if="dialectMeta?.requires_database" :label="dialectMeta.database_label">
            <el-input v-model="form.database" :placeholder="dialectMeta.database_placeholder" />
          </el-form-item>

          <el-form-item v-if="dialectMeta?.requires_username" label="用户名">
            <el-input v-model="form.username" />
          </el-form-item>

          <el-form-item v-if="dialectMeta?.requires_password" label="密码">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              :placeholder="editing?.has_password ? '留空则保持原密码不变' : ''"
            />
          </el-form-item>

          <el-button link type="primary" class="!mb-2" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? '隐藏高级选项' : '高级选项（自定义连接串 / Token 认证）' }}
          </el-button>

          <div v-if="showAdvanced" class="mb-3 space-y-1 rounded-lg border border-[var(--color-border)] p-3">
            <el-form-item label="自定义连接串（可选）">
              <el-input
                v-model="form.uri_override"
                type="textarea"
                :rows="2"
                placeholder="postgresql+psycopg://user:pass@host:5432/db，填写后忽略以上主机/端口等字段"
              />
            </el-form-item>
            <el-form-item label="Catalog 中的数据库名（可选）">
              <el-input v-model="form.catalog_database_name" placeholder="用于在数据目录中标识该库，默认沿用上方数据库名" />
            </el-form-item>
            <template v-if="dialectMeta?.supports_token_service">
              <el-form-item label="Token 服务地址（可选）">
                <el-input v-model="form.token_service_url" placeholder="https://tokens.example.com/v1" />
              </el-form-item>
              <el-form-item label="Token 服务用户名">
                <el-input v-model="form.token_username" />
              </el-form-item>
              <el-form-item label="Token 服务密码">
                <el-input
                  v-model="form.token_password"
                  type="password"
                  show-password
                  :placeholder="editing?.has_token_password ? '留空则保持原密码不变' : ''"
                />
              </el-form-item>
            </template>
          </div>

          <el-alert
            v-if="testResult"
            :type="testResult.ok ? 'success' : 'error'"
            :title="testResult.ok ? '连接成功' : testResult.detail"
            show-icon
            :closable="false"
          />
        </el-form>

        <template #footer>
          <el-button class="!rounded-xl" :loading="testing" @click="onTest">测试连接</el-button>
          <el-button class="!rounded-xl" @click="dialogOpen = false">取消</el-button>
          <el-button type="primary" class="!rounded-xl" :disabled="!canSave" :loading="saving" @click="onSave">
            保存
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppShell>
</template>

<style scoped>
.db-table {
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: #eff6ff;
}

.db-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
</style>
