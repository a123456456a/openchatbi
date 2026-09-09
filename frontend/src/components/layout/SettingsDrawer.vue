<script setup lang="ts">
import { PROVIDER_OPTIONS, useSettingsStore } from '../../stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <el-drawer
    v-model="settings.settingsOpen"
    title="设置"
    direction="rtl"
    size="360px"
  >
    <div class="flex flex-col gap-4">
      <div>
        <div class="text-sm font-medium text-slate-700 mb-2">模型 / Provider</div>
        <el-select
          :model-value="settings.provider"
          class="w-full"
          placeholder="默认"
          @update:model-value="settings.setProvider"
        >
          <el-option
            v-for="opt in PROVIDER_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <p class="text-xs text-slate-500 mt-2">聊天请求将带上所选 provider（空则用后端默认）。</p>
      </div>
    </div>
  </el-drawer>
</template>
