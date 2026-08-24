<template>
  <el-container class="atlas-app-layout-container">
    <el-container>
      <!-- 头部 -->
      <el-header class="header-wrapper">
        <div class="header-left">
          <div class="logo">
            <span class="logo-icon">🛰️</span>
            <span class="logo-title">卫星态势分析系统</span>
            <span class="logo-badge">SYSTEM</span>
          </div>
        </div>

        <div class="header-center">
          <MenuTree :active-menu="activeMenu" :menu-data="visibleMenus" menu-mode="horizontal" :show-icon="true" />
        </div>

        <div class="header-right actions-bar">
          <div class="user-panel">
            <div class="user-avatar-box">
              <el-avatar :size="32" icon="UserFilled" class="user-avatar" />
            </div>
            <div class="user-meta">
              <span class="user-name">{{ displayUserName }}</span>
              <span class="user-role-tag">{{ displayRoleText }}</span>
            </div>
            <button type="button" class="sci-logout-btn" @click="handleLogout">
              <span>退出登录</span>
            </button>
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
      title: '战场态势分析',
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
          path: '/system/satellites',
          meta: {
            title: '卫星管理',
            icon: 'icon-situation',
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
        {
          path: '/system/battles',
          meta: {
            title: '战场管理',
            icon: 'icon-situation',
            showInMenu: true,
          },
          children: [],
        },
      ],
    },
  ]
})

/** 算法分析管理前端静态菜单配置 */
const algorithmMenus = computed<DashboardMenuNode[]>(() => [
  {
    path: '/algorithm',
    meta: {
      title: '算法分析管理',
      icon: 'icon-layer',
      showInMenu: true,
    },
    children: [
      {
        path: '/algorithm/threat',
        meta: {
          title: '卫星威胁分析',
          icon: 'icon-situation',
          showInMenu: true,
        },
        children: [],
      },
      {
        path: '/algorithm/attackability',
        meta: {
          title: '可打击度分析',
          icon: 'icon-situation',
          showInMenu: true,
        },
        children: [],
      },
      {
        path: '/algorithm/killchain',
        meta: {
          title: '杀伤链方案',
          icon: 'icon-situation',
          showInMenu: true,
        },
        children: [],
      },
      {
        path: '/algorithm/evaluation',
        meta: {
          title: '打击结果评估',
          icon: 'icon-situation',
          showInMenu: true,
        },
        children: [],
      },
      {
        path: '/algorithm/simulation',
        meta: {
          title: '打击方案仿真',
          icon: 'icon-situation',
          showInMenu: true,
        },
        children: [],
      },
    ],
  },
])

const visibleMenus = computed<RouteRecordRaw[]>(() => {
  const backendMenus = filterMenusByPermission(buildMenuRoutes(authStore.menuTree))
  const mergedMenus = mergeMenus(
    mergeMenus(mergeMenus(homeMenu.value, backendMenus), filterMenusByPermission(algorithmMenus.value)),
    filterMenusByPermission(adminMenus.value)
  )
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
    background: linear-gradient(
      90deg,
      rgba(8, 22, 44, 0.98) 0%,
      rgba(13, 35, 62, 0.95) 50%,
      rgba(8, 22, 44, 0.98) 100%
    );
    border-bottom: 1px solid rgba(0, 225, 255, 0.25);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.5),
      0 1px 12px rgba(0, 225, 255, 0.15);
    padding: 0 24px;
    z-index: 100;

    .header-left {
      display: flex;
      align-items: center;
      flex: 0 0 auto;

      .logo {
        height: 60px;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;

        .logo-icon {
          font-size: 22px;
          filter: drop-shadow(0 0 6px rgba(0, 225, 255, 0.6));
        }

        .logo-title {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: 1.2px;
          background: linear-gradient(135deg, #ffffff 30%, #00e1ff 100%);
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px rgba(0, 225, 255, 0.3));
        }

        .logo-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0, 225, 255, 0.12);
          color: #00e1ff;
          border: 1px solid rgba(0, 225, 255, 0.3);
          letter-spacing: 0.8px;
        }
      }
    }

    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding-left: 20px;
      min-width: 0;

      :deep(.side-bar--menu--horizontal) {
        width: 100%;
      }
    }

    .header-right {
      flex: 0 0 auto;
      display: flex;
      align-items: center;

      .user-panel {
        display: flex;
        align-items: center;
        gap: 14px;

        .user-avatar-box {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(0, 225, 255, 0.6), rgba(0, 150, 255, 0.2));
          box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);

          .user-avatar {
            background: #0d2744;
            color: #00e1ff;
          }
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .user-name {
            font-size: 13px;
            font-weight: 700;
            color: #f1f7ff;
            line-height: 1.2;
          }

          .user-role-tag {
            font-size: 11px;
            color: #7dd3fc;
            background: rgba(0, 225, 255, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            border: 1px solid rgba(0, 225, 255, 0.2);
            line-height: 1.3;
            width: fit-content;
          }
        }

        .sci-logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          cursor: pointer;
          transition: all 0.25s ease;

          &:hover {
            background: rgba(239, 68, 68, 0.25);
            border-color: rgba(239, 68, 68, 0.6);
            color: #ffffff;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
            transform: translateY(-1px);
          }

          &:active {
            transform: translateY(0);
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
