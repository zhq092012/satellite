<script setup lang="ts">
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { onMounted } from 'vue'
import SatelliteProfile from '@/views/SatelliteProfile/SatelliteProfile.vue'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'

const { satelliteProfileVisible, satelliteProfileNorad } = useSatelliteProfileDialog()

/**
 * 设置主题
 */
// const setTheme = () => {
//   const theme = localStorage.getItem('theme')
//   document.documentElement.setAttribute('class', theme ?? 'light')
//   document.documentElement.setAttribute('class', 'dark')
// }
onMounted(() => {})
</script>

<template>
  <el-config-provider :locale="zhCn" namespace="atlas-app">
    <router-view></router-view>
    <SatelliteProfile v-model="satelliteProfileVisible" :norad="satelliteProfileNorad" />
  </el-config-provider>
</template>

<style lang="scss"></style>
