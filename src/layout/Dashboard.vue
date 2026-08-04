<template>
  <el-container class="atlas-app-layout-container">
    <el-container>
      <!-- 头部 -->
      <el-header class="header-wrapper">
        <div class="header-left">
          <div class="logo">卫星态势分析系统</div>
        </div>

        <div class="header-center">
          <MenuTree :active-menu="activeMenu" :menu-data="visibleMenus" menu-mode="horizontal" :show-icon="false" />
        </div>

        <div class="header-right actions-bar">
          <!-- <div v-show="route.name === 'Home'" class="menus">
            <el-switch
              v-model="layoutStore.showAnalysisPanel"
              active-action-icon="View"
              inactive-action-icon="Hide"
              active-text="战场列表"
              @change="layoutStore.toggleShowAnalysisList"
            />
            <el-switch
              v-model="layoutStore.showSatelliteList"
              active-action-icon="View"
              inactive-action-icon="Hide"
              active-text="卫星列表"
              @change="layoutStore.toggleShowSatelliteList"
            />
          </div> -->

          <div class="user-panel">
            <el-avatar :size="32" icon="UserFilled" />
            <div class="user-meta">
              <span class="user-name">{{ displayUserName }}</span>
              <span class="user-role">{{ displayRoleText }}</span>
            </div>
            <el-button type="danger" plain size="small" @click="handleLogout">退出登录</el-button>
          </div>
        </div>

        <div class="header-right" v-show="route.name === 'Satellite'">
          <el-button type="primary" size="small" plain round @click="router.go(-1)">返回首页</el-button>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-scrollbar class="scroller-bar">
        <el-main class="main-wrapper">
          <router-view v-slot="{ Component, route }">
            <keep-alive include="Home">
              <component :is="Component" :key="route.name" />
            </keep-alive>
          </router-view>
        </el-main>
      </el-scrollbar>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { type RouteRecordRaw, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MenuTree from './MenuTree.vue'
import { logout as logoutApi, type MenuItem } from '@/api/auth'
import { useAuthStore } from '@/store/modules/auth'
import { useLayoutStore } from '@/store/modules/layout'

const layoutStore = useLayoutStore()
const authStore = useAuthStore()
// 获取路由实例
const route = useRoute()
const router = useRouter()

type DashboardMenuNode = Omit<RouteRecordRaw, 'children' | 'meta'> & {
  meta?: {
    title?: string
    icon?: string
    showInMenu?: boolean
    permission?: string
  }
  children?: DashboardMenuNode[]
}

const activeMenu = computed(() => (typeof route.path === 'string' ? route.path : '/home'))

const buildMenuRoutes = (menus: MenuItem[], parentPath = ''): DashboardMenuNode[] => {
  const result: DashboardMenuNode[] = []

  for (const menu of menus) {
    if (menu.type === 3) {
      continue
    }

    const rawPath = typeof menu.path === 'string' && menu.path.trim() !== '-' ? menu.path.trim() : ''
    const currentPath = rawPath
      ? rawPath.startsWith('/')
        ? rawPath
        : `${parentPath}/${rawPath}`.replace(/\/+/g, '/')
      : parentPath

    if (!currentPath) {
      continue
    }

    const children = menu.children?.length ? buildMenuRoutes(menu.children, currentPath) : []

    result.push({
      path: currentPath,
      meta: {
        title: menu.menuName,
        icon: menu.icon,
        showInMenu: true,
        permission: menu.permission,
      },
      children,
    })
  }

  return result
}

const mergeMenus = (menus: DashboardMenuNode[], extraMenus: DashboardMenuNode[]) => {
  const merged: DashboardMenuNode[] = menus.map((menu) => ({
    ...menu,
    children: menu.children ? [...menu.children] : [],
  }))

  extraMenus.forEach((item: DashboardMenuNode) => {
    const existing = merged.find((menu) => menu.path === item.path)
    if (!existing) {
      merged.push({
        ...item,
        children: item.children ? [...item.children] : [],
      })
      return
    }

    const existingChildren = existing.children ?? []
    const incomingChildren = item.children ?? []
    existing.children = mergeMenus(existingChildren, incomingChildren)
  })

  return merged
}

const filterMenusByPermission = (menus: DashboardMenuNode[]): DashboardMenuNode[] => {
  const isAdmin = authStore.roles.includes('admin')

  return menus
    .map((menu): DashboardMenuNode | null => {
      const children: DashboardMenuNode[] = menu.children?.length ? filterMenusByPermission(menu.children) : []
      const requiredPermission = menu.meta?.permission
      const permitted = isAdmin || !requiredPermission || authStore.permissions.includes(requiredPermission)

      if (!permitted && children.length === 0) {
        return null
      }

      return {
        ...menu,
        children,
      }
    })
    .filter((menu): menu is DashboardMenuNode => menu !== null)
}

const homeMenu = computed<DashboardMenuNode[]>(() => [
  {
    path: '/home',
    meta: {
      title: '战场列表',
      icon: 'icon-situation',
      showInMenu: true,
    },
    children: [],
  },
])

const adminMenus = computed(() => {
  const roleIsAdmin = authStore.roles.includes('admin')
  if (!roleIsAdmin) {
    return []
  }

  return [
    {
      path: '/system',
      meta: {
        title: '系统管理',
        icon: 'icon-yunweizhishichouqu',
        showInMenu: true,
      },
      children: [
        {
          path: '/system/users',
          meta: {
            title: '用户管理',
            icon: 'icon-us',
            showInMenu: true,
          },
          children: [],
        },
        {
          path: '/system/roles',
          meta: {
            title: '角色管理',
            icon: 'icon-jurassic_data',
            showInMenu: true,
          },
          children: [],
        },
        {
          path: '/system/menus',
          meta: {
            title: '菜单管理',
            icon: 'icon-layer',
            showInMenu: true,
          },
          children: [],
        },
        {
          path: '/system/weapons',
          meta: {
            title: '武器管理',
            icon: 'icon-sword',
            showInMenu: true,
            permission: 'system:weapon:list',
          },
          children: [],
        },
        {
          path: '/system/basestations',
          meta: {
            title: '基站管理',
            icon: 'icon-basestation',
            showInMenu: true,
            permission: 'system:basestations:list',
          },
          children: [],
        },
        {
          path: '/system/missiles',
          meta: {
            title: '导弹管理',
            icon: 'icon-missile',
            showInMenu: true,
            permission: 'system:missiles:list',
          },
          children: [],
        },

        {
          path: '/system/missileBases',
          meta: {
            title: '导弹基地管理',
            icon: 'icon-missile-base',
            showInMenu: true,
            permission: 'system:missileBases:list',
          },
          children: [],
        },
      ],
    },
  ]
})

const visibleMenus = computed<RouteRecordRaw[]>(() => {
  const backendMenus = filterMenusByPermission(buildMenuRoutes(authStore.menuTree))
  const mergedMenus = mergeMenus(mergeMenus(homeMenu.value, backendMenus), filterMenusByPermission(adminMenus.value))
  return mergedMenus as RouteRecordRaw[]
})

const displayUserName = computed(() => {
  return authStore.userInfo?.nickname || authStore.userInfo?.username || '未登录用户'
})

const displayRoleText = computed(() => {
  if (authStore.roles.includes('admin')) {
    return '管理员'
  }
  if (authStore.roles.length > 0) {
    return authStore.roles.join(' / ')
  }
  return '普通用户'
})

const handleLogout = async () => {
  try {
    await logoutApi()
  } catch {
    // ignore logout API failures and clear local auth anyway
  }

  authStore.logout()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'Login' })
}

onMounted(() => {})

onUnmounted(() => {})
</script>

<style lang="scss" scoped>
.atlas-app-layout-container {
  .header-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    gap: 24px;
    height: 60px;
    background: var(--header-bg-gradient);
    padding: 0 20px;

    .header-left {
      display: flex;
      align-items: center;
      flex: 0 0 auto;

      .logo {
        height: 60px;
        line-height: 60px;
        font-size: 18px;
        font-weight: bold;
        color: #ffffff;
        letter-spacing: 1px;
        white-space: nowrap;
      }
    }

    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;

      :deep(.side-bar--menu--horizontal) {
        width: 100%;
      }
    }

    .header-right {
      flex: 0 0 auto;
      display: flex;
      align-items: center;

      .menus {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .user-panel {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-left: 16px;

        .user-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          color: var(--text-color-strong);

          .user-name {
            font-size: 14px;
            font-weight: 600;
          }

          .user-role {
            font-size: 12px;
            color: rgba(217, 233, 251, 0.72);
          }
        }
      }
    }
  }

  .scroller-bar {
    height: calc(100vh - 60px);
  }

  .main-wrapper {
    padding: 0;
    width: 100%;
    overflow-x: hidden;
  }
}
</style>
