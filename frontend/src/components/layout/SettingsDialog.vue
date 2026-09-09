<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'

import { useSettingsStore, type SettingsForm } from '../../stores/settings'

const settings = useSettingsStore()
const saving = shallowRef(false)

const form = reactive<SettingsForm>({
  provider: '',
  api_key: '',
  model: '',
  base_url: '',
})

function findCatalog(provider: string) {
  return settings.catalog.find((item) => item.id === provider)
}

function findConfig(provider: string) {
  return settings.configs.find((row) => row.provider === provider)
}

function applyProvider(provider: string) {
  const meta = findCatalog(provider)
  const existing = findConfig(provider)
  form.provider = provider
  form.api_key = ''
  form.model = existing?.model || meta?.default_model || ''
  form.base_url = existing?.base_url || meta?.default_base_url || ''
}

async function onOpen() {
  try {
    await settings.load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载设置失败')
    return
  }
  const firstId = settings.catalog[0]?.id ?? ''
  applyProvider(settings.activeProvider || firstId)
}

function onProviderChange(provider: string) {
  applyProvider(provider)
}

const keyPlaceholder = computed(() => {
  const row = findConfig(form.provider)
  if (row?.has_key && row.api_key_masked) return row.api_key_masked
  return '请输入 API Key'
})

const requiresBaseUrl = computed(() => Boolean(findCatalog(form.provider)?.requires_base_url))

const hasSavedKey = computed(() => Boolean(findConfig(form.provider)?.has_key))

const basePlaceholder = computed(() => {
  const meta = findCatalog(form.provider)
  if (meta?.requires_base_url) return '必填，例如 https://api.example.com/v1'
  return meta?.default_base_url || '可选'
})

const canSave = computed(() => {
  if (!form.provider || !form.model.trim()) return false
  if (requiresBaseUrl.value && !form.base_url.trim()) return false
  const row = findConfig(form.provider)
  if (!form.api_key.trim() && !row?.has_key) return false
  return true
})

const saveHint = computed(() => {
  if (requiresBaseUrl.value && !form.base_url.trim()) {
    return 'OpenAI Compatible 必须填写 Base URL'
  }
  const row = findConfig(form.provider)
  if (!form.api_key.trim() && !row?.has_key) return '请填写 API Key'
  if (!form.model.trim()) return '请填写模型名称'
  return ''
})

async function onSave() {
  if (!canSave.value) return
  saving.value = true
  try {
    await settings.save({
      provider: form.provider,
      api_key: form.api_key,
      model: form.model.trim(),
      base_url: form.base_url.trim(),
    })
    ElMessage.success('已保存并设为当前模型')
    settings.closeSettings()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="settings.settingsOpen"
    title="模型设置"
    width="520px"
    @open="onOpen"
  >
    <el-form label-position="top">
      <el-form-item label="供应商">
        <el-select
          v-model="form.provider"
          class="w-full"
          placeholder="选择供应商"
          :disabled="settings.loading"
          @change="onProviderChange"
        >
          <el-option
            v-for="item in settings.catalog"
            :key="item.id"
            :label="item.label"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="API Key">
        <el-input
          v-model="form.api_key"
          type="password"
          show-password
          autocomplete="off"
          :placeholder="keyPlaceholder"
          :disabled="settings.loading"
        />
        <p
          v-if="hasSavedKey"
          class="text-xs text-slate-500 mt-1"
        >
          留空则保留已保存的密钥
        </p>
      </el-form-item>
      <el-form-item label="模型">
        <el-input v-model="form.model" :disabled="settings.loading" />
      </el-form-item>
      <el-form-item label="Base URL">
        <el-input
          v-model="form.base_url"
          :placeholder="basePlaceholder"
          :disabled="settings.loading"
        />
        <p
          v-if="requiresBaseUrl && !form.base_url.trim()"
          class="text-xs text-amber-600 mt-1"
        >
          OpenAI Compatible 必须填写 Base URL
        </p>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="settings.closeSettings()">取消</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!canSave || settings.loading"
        @click="onSave"
      >
        保存并使用
      </el-button>
      <p v-if="saveHint && !canSave" class="text-xs text-slate-500 mt-2 text-left">
        {{ saveHint }}
      </p>
    </template>
  </el-dialog>
</template>
