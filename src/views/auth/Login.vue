<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="brand-block">
        <div class="brand-badge">C4</div>
        <p class="brand-kicker">SECURE ACCESS</p>
        <h1>卫星态势指挥平台</h1>
        <p class="brand-subtitle">保密环境登录 · 态势感知与任务协同</p>
      </div>

      <el-card class="login-card" shadow="always">
        <h2>账号登录</h2>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="login-form">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" size="large" autocomplete="username" />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              show-password
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-button :loading="loading" type="primary" size="large" class="login-button" @click="handleLogin">
            登录系统
          </el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/modules/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  if (!formRef.value) {
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }

    loading.value = true
    try {
      const response = await login({ username: form.username, password: form.password })
      if (response.code !== 200 || !response.data?.token) {
        ElMessage.error(response.msg || '登录失败')
        return
      }

      authStore.setAuth(response.data)
      ElMessage.success('登录成功')

      let redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
      if (!redirect || redirect.startsWith('/login')) {
        redirect = '/home'
      }
      await router.replace(redirect)
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(38, 97, 170, 0.35), transparent 30%),
    radial-gradient(circle at bottom right, rgba(0, 201, 255, 0.18), transparent 32%),
    linear-gradient(135deg, #06111d 0%, #0b2034 45%, #102844 100%);
}

.login-panel {
  width: min(980px, 100%);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 24px;
  align-items: center;
}

.brand-block {
  color: #eaf3ff;
  text-align: center;

  .brand-badge {
    margin: 0 auto 14px;
    width: 72px;
    height: 72px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-weight: 700;
    letter-spacing: 3px;
    font-size: 22px;
    color: #eaf3ff;
    background: linear-gradient(135deg, #21496f 0%, #12324f 50%, #0f2236 100%);
    border: 1px solid rgba(107, 168, 214, 0.35);
    box-shadow: 0 18px 40px rgba(10, 28, 46, 0.42);
  }

  .brand-kicker {
    margin: 0 0 10px;
    color: rgba(178, 210, 236, 0.78);
    font-size: 12px;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 3.8vw, 48px);
    line-height: 1.1;
    letter-spacing: 1px;
  }

  .brand-subtitle {
    margin: 16px 0 0;
    color: rgba(234, 243, 255, 0.72);
    font-size: 15px;
    letter-spacing: 1px;
  }
}

.login-card {
  border-radius: 16px;
  border: 1px solid rgba(126, 176, 214, 0.18);
  background: rgba(8, 18, 29, 0.92);
  color: #eaf3ff;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.35);

  h2 {
    margin: 0 0 20px;
    letter-spacing: 1px;
  }
}

.login-form {
  :deep(.el-form-item__label) {
    color: rgba(234, 243, 255, 0.78);
  }
}

.login-button {
  width: 100%;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .login-panel {
    grid-template-columns: 1fr;
  }
}
</style>
