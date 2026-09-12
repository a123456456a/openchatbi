<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, User } from '@element-plus/icons-vue'

import AppShell from '../../components/layout/AppShell.vue'
import { createUser, deleteUser, listUsers, patchUser, type UserOut } from '../../api/users'
import { useAuthStore } from '../../stores/auth'

const loading = ref(false)
const users = ref<UserOut[]>([])
const dialogOpen = ref(false)
const form = reactive({
  username: '',
  password: '',
  role: 'analyst',
})
const auth = useAuthStore()

function isSelf(row: UserOut) {
  return !!auth.userId && row.id === auth.userId
}

function isLastAdmin(row: UserOut) {
  if (row.role !== 'admin') return false
  return users.value.filter((u) => u.role === 'admin').length <= 1
}

function deleteDisabledReason(row: UserOut): string | undefined {
  if (isSelf(row)) return '不能删除当前登录账号'
  if (isLastAdmin(row)) return '必须保留至少一名管理员'
  return undefined
}

async function refresh() {
  loading.value = true
  try {
    users.value = await listUsers()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})

async function onCreate() {
  try {
    await createUser({ ...form })
    ElMessage.success('已创建用户')
    dialogOpen.value = false
    form.username = ''
    form.password = ''
    form.role = 'analyst'
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '创建失败')
  }
}

async function toggleActive(row: UserOut) {
  try {
    await patchUser(row.id, { is_active: !row.is_active })
    ElMessage.success('已更新状态')
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  }
}

async function changeRole(row: UserOut, role: string) {
  try {
    await patchUser(row.id, { role })
    ElMessage.success('已更新角色')
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  }
}

async function onDelete(row: UserOut) {
  const reason = deleteDisabledReason(row)
  if (reason) {
    ElMessage.warning(reason)
    return
  }
  try {
    await deleteUser(row.id)
    ElMessage.success('已删除用户')
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
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
              <el-icon :size="20"><User /></el-icon>
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
                用户管理
              </h1>
              <p class="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                管理账号角色、启用状态与删除
              </p>
            </div>
          </div>
          <el-button type="primary" class="!h-10 !rounded-xl" @click="dialogOpen = true">
            <el-icon class="mr-1"><Plus /></el-icon>
            创建用户
          </el-button>
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]"
        >
          <el-table v-loading="loading" :data="users" stripe class="users-table">
            <el-table-column prop="username" label="用户名" min-width="120" />
            <el-table-column prop="role" label="角色" width="140">
              <template #default="{ row }">
                <el-select
                  :model-value="row.role"
                  size="small"
                  @change="(v: string) => changeRole(row, v)"
                >
                  <el-option label="admin" value="admin" />
                  <el-option label="analyst" value="analyst" />
                  <el-option label="viewer" value="viewer" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" effect="light" round>
                  {{ row.is_active ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="toggleActive(row)">
                  {{ row.is_active ? '停用' : '启用' }}
                </el-button>
                <el-button
                  size="small"
                  link
                  type="danger"
                  :disabled="!!deleteDisabledReason(row)"
                  :title="deleteDisabledReason(row)"
                  @click="onDelete(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <el-dialog v-model="dialogOpen" title="创建用户" width="420px" class="rounded-2xl">
        <el-form label-position="top">
          <el-form-item label="用户名">
            <el-input v-model="form.username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="form.role" class="w-full">
              <el-option label="admin" value="admin" />
              <el-option label="analyst" value="analyst" />
              <el-option label="viewer" value="viewer" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button class="!rounded-xl" @click="dialogOpen = false">取消</el-button>
          <el-button type="primary" class="!rounded-xl" @click="onCreate">创建</el-button>
        </template>
      </el-dialog>
    </div>
  </AppShell>
</template>

<style scoped>
.users-table {
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: #eff6ff;
}

.users-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
</style>
