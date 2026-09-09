<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import AppShell from '../../components/layout/AppShell.vue'
import { createUser, listUsers, patchUser, type UserOut } from '../../api/users'

const loading = ref(false)
const users = ref<UserOut[]>([])
const dialogOpen = ref(false)
const form = reactive({
  username: '',
  password: '',
  role: 'analyst',
})

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
</script>

<template>
  <AppShell>
    <div class="flex-1 overflow-auto p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-lg font-semibold text-slate-800">用户管理</h1>
        <el-button type="primary" @click="dialogOpen = true">创建用户</el-button>
      </div>

      <el-table v-loading="loading" :data="users" stripe border>
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
            <el-tag :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="toggleActive(row)">
              {{ row.is_active ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="dialogOpen" title="创建用户" width="420px">
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
          <el-button @click="dialogOpen = false">取消</el-button>
          <el-button type="primary" @click="onCreate">创建</el-button>
        </template>
      </el-dialog>
    </div>
  </AppShell>
</template>
