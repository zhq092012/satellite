<template>
  <el-container class="el-layout-container">
    <el-container>
      <!-- 头部 -->
      <el-header class="header-wrapper">
        <div class="header-left">
          <div class="logo">
            <span class="logo-title">作战目标选择系统</span>
          </div>
        </div>

        <div class="header-center">
          <MenuTree :active-menu="activeMenu" :menu-data="visibleMenus" menu-mode="horizontal" :show-icon="true" />
        </div>

        <div class="header-right actions-bar">
          <!-- 当前场景（即战场）显示 / 下拉切换 -->
          <div class="task-status-bar">
            <el-dropdown trigger="click" :disabled="sceneSwitching" @command="handleSwitchScene"
              @visible-change="handleSceneDropdownVisible" popper-class="scene-selector-popper">
              <div class="scene-trigger" :class="{ 'is-empty': !layoutStore.battle }">
                <template v-if="layoutStore.battle">
                  <span class="scene-name" :title="layoutStore.battle.name">{{ layoutStore.battle.name }}</span>
                </template>

                <el-icon class="scene-arrow">
                  <ArrowDown />
                </el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu class="scene-dropdown-menu">
                  <el-dropdown-item v-for="battle in battleList" :key="battle.id" :command="battle.id"
                    :disabled="sceneSwitching" :class="{ 'is-active': layoutStore.battle?.id === battle.id }">
                    {{ battle.name }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="battleList.length === 0" disabled>
                    {{ loadingData ? '正在加载场景...' : '暂无场景数据' }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <el-dropdown trigger="click" @command="handleCommand" popper-class="user-profile-popper">
            <div class="user-trigger">
              <span class="user-name">{{ displayUserName }}</span>
              <el-icon class="user-arrow">
                <ArrowDown />
              </el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="user-dropdown-menu">
                <el-dropdown-item v-if="isAdmin" command="system" class="user-menu-item">
                  <el-icon>
                    <Setting />
                  </el-icon>
                  <span>系统管理</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="isAdmin" command="data-manage" class="user-menu-item">
                  <el-icon>
                    <Folder />
                  </el-icon>
                  <span>数据管理</span>
                </el-dropdown-item>
                <el-dropdown-item command="algorithm" class="user-menu-item">
                  <el-icon>
                    <DataAnalysis />
                  </el-icon>
                  <span>算法管理</span>
                </el-dropdown-item>
                <el-dropdown-item divided command="logout" class="user-menu-item user-logout-item">
                  <el-icon>
                    <SwitchButton />
                  </el-icon>
                  <span>退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="header-right" v-show="route.name === 'Satellite'">
          <el-button type="primary" size="small" plain round @click="router.go(-1)">返回首页</el-button>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-scrollbar class="scroller-bar">
        <el-main class="main-wrapper">
          <router-view v-slot="{ Component, route: viewRoute }">
            <keep-alive include="Home">
              <component :is="Component" :key="getRouterViewKey(viewRoute)" />
            </keep-alive>
          </router-view>
        </el-main>
      </el-scrollbar>
    </el-container>

  </el-container>
</template>

<script setup lang="ts">
/**
 * 登录后主布局：顶栏场景切换、权限菜单、用户操作区，以及 `router-view` 主内容。
 * 首页相关路由使用统一 keep-alive key（`Home`），避免在 `/home/*` 子路径间切换时销毁态势页状态。
 */
import { computed, onMounted, ref } from 'vue'
import { type RouteRecordRaw, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, DataAnalysis, Folder, Setting, SwitchButton } from '@element-plus/icons-vue'
import MenuTree from './MenuTree.vue'
import { logout as logoutApi, type MenuItem } from '@/api/auth'
import { useAuthStore } from '@/store/modules/auth'
import { useLayoutStore } from '@/store/modules/layout'
import { getBattleList, getTaskList } from '@/api/dashboard'
import { notifyTaskListValidationErrors } from '@/utils/c2TaskPanelEditor'
import type { BattleForm } from '@/types/dashboard'

const authStore = useAuthStore()
const layoutStore = useLayoutStore()
// 获取路由实例
const route = useRoute()
const router = useRouter()

/** 顶栏/侧栏菜单节点（由后端 menuTree 转换而来） */
type DashboardMenuNode = Omit<RouteRecordRaw, 'children' | 'meta'> & {
  meta?: {
    /** 菜单展示标题 */
    title?: string
    /** 图标标识或 emoji */
    icon?: string
    /** 是否在导航中展示 */
    showInMenu?: boolean
    /** 访问所需权限码；admin 角色不受限 */
    permission?: string
  }
  children?: DashboardMenuNode[]
}

const activeMenu = computed(() => (typeof route.path === 'string' ? route.path : '/home'))

/**
 * 将后端菜单树转为 Vue Router 可用的菜单节点列表。
 *
 * @param menus 后端菜单项
 * @param parentPath 父级 path 前缀，用于拼接相对 path
 * @returns 扁平化后的顶栏菜单树
 */
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

/**
 * 顶栏只保留整体态势分析和方案管理。
 * 场景、卫星、地面站、数据中心、武器、卫星网络已收进右侧「数据管理」页签。
 */
const homeMenu = computed<DashboardMenuNode[]>(() => [
  {
    path: '/home',
    meta: {
      title: '整体态势分析',
      icon: 'icon-situation',
      showInMenu: true,
    },
    children: [],
  },
  {
    path: '/home/strike-plan',
    meta: {
      title: '方案管理',
      icon: 'icon-situation',
      showInMenu: true,
    },
    children: [],
  },
])

/**
 * 五个分析页共用 Home 实例，避免切页时销毁 keep-alive 缓存。
 * @param viewRoute 当前 router-view 对应的路由
 * @returns keep-alive 使用的组件 key
 */
const getRouterViewKey = (viewRoute: { path?: string; name?: string | symbol | null }) => {
  const path = typeof viewRoute.path === 'string' ? viewRoute.path : ''
  if (path === '/home' || path.startsWith('/home/')) {
    return 'Home'
  }
  return viewRoute.name ?? path
}




const visibleMenus = computed<RouteRecordRaw[]>(() => {
  const backendMenus = filterMenusByPermission(buildMenuRoutes(authStore.menuTree))
  const mergedMenus = mergeMenus(homeMenu.value, backendMenus)
  /** 顶栏首页/资源管理项保持平级，避免后端子菜单把它变成下拉 */
  const topMenuPaths = new Set(homeMenu.value.map((item) => item.path))

  return mergedMenus
    .map((menu) => {
      if (topMenuPaths.has(menu.path)) {
        return { ...menu, children: [] }
      }
      return menu
    })
    .filter((menu) => {
      const path = menu.path || ''
      const title = (menu.meta as { title?: string } | undefined)?.title || ''
      return (
        !path.startsWith('/system') &&
        !path.startsWith('/data-manage') &&
        !path.startsWith('/algorithm') &&
        !title.includes('系统管理') &&
        !title.includes('数据管理') &&
        !title.includes('算法分析管理')
      )
    }) as RouteRecordRaw[]
})

const isAdmin = computed(() => authStore.roles.includes('admin'))

const displayUserName = computed(() => {
  return authStore.userInfo?.nickname || authStore.userInfo?.username || '未登录用户'
})


const handleCommand = (command: string) => {
  if (command === 'system') {
    router.push('/system')
  } else if (command === 'data-manage') {
    router.push('/data-manage')
  } else if (command === 'algorithm') {
    if (!layoutStore.activeTask) {
      ElMessage.warning('尚未选择战场任务，请先在首页选择战场及任务！')
      return
    }
    router.push('/algorithm')
  } else if (command === 'logout') {
    handleLogout()
  }
}

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

/** 场景（战场）列表加载状态 */
const loadingData = ref(false)
/** 场景切换中，避免重复点击 */
const sceneSwitching = ref(false)
/** 可供切换的场景列表（数据源为战场列表） */
const battleList = ref<BattleForm[]>([])

/**
 * 加载全部场景（战场）列表，供顶栏下拉切换使用。
 *
 * @returns 无返回值；失败时保留已有列表
 */
const loadBattleList = async () => {
  loadingData.value = true
  try {
    const res = await getBattleList()
    if (res.code === 200 && Array.isArray(res.data)) {
      battleList.value = res.data
    }
  } catch (error) {
    console.error('加载场景列表失败:', error)
  } finally {
    loadingData.value = false
  }
}

/**
 * 下拉展开时刷新场景列表，保证刚添加的场景能出现在选项中。
 *
 * @param visible 下拉是否展开
 */
const handleSceneDropdownVisible = async (visible: boolean) => {
  if (visible) {
    await loadBattleList()
  }
}

/**
 * 切换当前场景（即切换战场）。
 * 写入全局 battle 后，左侧任务列表会按新场景 ID 重新拉取任务；
 * 若当前任务不属于新场景，则自动选中该场景下的第一个任务并刷新矩阵。
 *
 * @param battleId 下拉项 command，对应战场 ID
 */
const handleSwitchScene = async (battleId: number | string) => {
  const id = Number(battleId)
  const battle = battleList.value.find((item) => item.id === id)
  if (!battle?.id || sceneSwitching.value) return
  if (layoutStore.battle?.id === battle.id) return

  sceneSwitching.value = true
  try {
    layoutStore.setActiveBattle(battle)
    layoutStore.setSelectedSatSeries('')

    const taskRes = await getTaskList(battle.id)
    const tasks = taskRes.code === 200 && Array.isArray(taskRes.data) ? taskRes.data : []
    const validationErrors = taskRes.taskListValidationErrors ?? taskRes.combatAreaErrors
    if (validationErrors?.length) {
      notifyTaskListValidationErrors(validationErrors, (message) => {
        ElMessage.error({ message, duration: 10000, showClose: true })
      })
    }
    layoutStore.setActiveBattle({ ...battle, tasks })

    const matchedTask = tasks.find((task) => task.id === layoutStore.activeTask?.id)
    if (matchedTask) {
      layoutStore.setActiveTask(matchedTask)
    } else if (tasks.length > 0) {
      layoutStore.setActiveTask(tasks[0])
    } else {
      layoutStore.setActiveTask(null)
    }

    ElMessage.success(`已切换场景：${battle.name}`)

    if (layoutStore.activeTask?.id && layoutStore.selectedSatSeries) {
      await layoutStore.fetchMatrixForCurrentScope(true)
    }
  } catch (error) {
    console.error('切换场景失败:', error)
    ElMessage.error('切换场景失败，请稍后重试')
  } finally {
    sceneSwitching.value = false
  }
}

onMounted(async () => {
  await loadBattleList()

  if (layoutStore.activeTask?.id && layoutStore.selectedSatSeries) {
    await layoutStore.fetchMatrixForCurrentScope(false)
  }
})

</script>

<style lang="scss" scoped>
.el-layout-container {
  .header-wrapper {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    position: relative;
    gap: 3px;
    height: 60px;
    background: linear-gradient(90deg,
        var(--swatch-rgba-8-22-44-0_98) 0%,
        var(--swatch-rgba-13-35-62-0_95) 50%,
        var(--swatch-rgba-8-22-44-0_98) 100%);
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.25);
    box-shadow:
      0 4px 20px var(--swatch-rgba-0-0-0-0_5),
      0 1px 12px rgba(var(--accent-cyan-rgb), 0.15);
    padding: 0 0 0 24px;
    z-index: 100;

    .header-left {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      padding-right: 20px;

      .logo {
        height: 60px;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;

        .logo-icon {
          font-size: var(--font-size-2xl);
          filter: drop-shadow(0 0 6px rgba(var(--accent-cyan-rgb), 0.6));
        }

        .logo-title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-heavy);
          letter-spacing: 1.2px;
          background-clip: text;
          filter: drop-shadow(0 0 10px rgba(var(--accent-cyan-rgb), 0.3));
        }

        .logo-badge {
          display: inline-block;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-bold);
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(var(--accent-cyan-rgb), 0.12);
          color: var(--accent-cyan);
          border: 1px solid rgba(var(--accent-cyan-rgb), 0.3);
          letter-spacing: 0.8px;
        }
      }
    }

    .header-center {
      flex: 1;
      display: flex;
      align-items: stretch;
      justify-content: flex-start;
      min-width: 0;
      height: 60px;

      :deep(.side-bar--menu--horizontal) {
        width: 100%;
        height: 60px;
      }
    }

    .header-right {
      flex: 0 0 auto;
      display: flex;
      align-items: stretch;
      height: 60px;
      gap: 3px;

      /* 当前场景（战场）下拉切换 */
      .task-status-bar {
        display: flex;
        align-items: stretch;
        height: 60px;

        :deep(.el-dropdown) {
          display: flex;
          align-items: stretch;
          height: 60px;
          outline: none !important;
        }

        .scene-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 18px;
          height: 60px;
          background: transparent;
          border: none;
          border-radius: 0;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: var(--font-size-base);
          box-sizing: border-box;
          outline: none;
          max-width: 360px;

          .scene-label {
            color: var(--swatch-8eb3d6);
            flex-shrink: 0;
          }

          .scene-name {
            color: var(--accent-cyan);
            font-weight: var(--font-weight-bold);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .scene-empty {
            color: var(--color-warning);
            font-weight: var(--font-weight-semibold);
          }

          .scene-arrow {
            font-size: var(--font-size-sm);
            color: var(--color-info-soft);
            flex-shrink: 0;
            transition: transform 0.25s ease, color 0.2s ease;
          }

          &:hover {
            background: rgba(var(--accent-cyan-rgb), 0.08);

            .scene-name,
            .scene-arrow {
              color: var(--accent-cyan);
            }
          }

          &[aria-expanded="true"] {
            background: rgba(var(--accent-cyan-rgb), 0.14);

            .scene-arrow {
              transform: rotate(180deg);
              color: var(--accent-cyan);
            }
          }
        }
      }

      :deep(.el-dropdown),
      :deep(.el-dropdown) {
        display: flex;
        align-items: stretch;
        height: 60px;
        outline: none !important;
      }

      .user-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 18px;
        height: 60px;
        border-radius: 0;
        cursor: pointer;
        user-select: none;
        outline: none;
        background: transparent;
        border: none;
        margin: 0;
        box-sizing: border-box;
        transition: all 0.2s ease;

        &:focus,
        &:focus-visible {
          outline: none !important;
        }

        .user-name {
          font-size: var(--font-size-subtitle);
          font-weight: var(--font-weight-bold);
          color: var(--text-color-strong);
          line-height: 1.2;
          transition: color 0.2s ease;
        }

        .user-arrow {
          font-size: var(--font-size-sm);
          color: var(--color-info-soft);
          transition: transform 0.25s ease, color 0.2s ease;
        }

        &:hover {
          background: rgba(var(--accent-cyan-rgb), 0.08);

          .user-name,
          .user-arrow {
            color: var(--accent-cyan);
          }
        }

        &[aria-expanded="true"] {
          background: rgba(var(--accent-cyan-rgb), 0.14);

          .user-arrow {
            transform: rotate(180deg);
            color: var(--accent-cyan);
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

/* 用户名下拉菜单样式（Teleport 到 body，需要使用 :global） */
:global(.user-profile-popper) {
  background: var(--swatch-rgba-8-24-48-0_98) !important;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.3) !important;
  box-shadow:
    0 8px 24px var(--swatch-rgba-0-0-0-0_6),
    0 0 14px rgba(var(--accent-cyan-rgb), 0.15) !important;
  backdrop-filter: blur(12px);
  border-radius: 6px !important;
  padding: 4px 0 !important;

  .el-popper__arrow::before,
  .el-popper__arrow::before {
    background: var(--swatch-rgba-8-24-48-0_98) !important;
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.3) !important;
  }

  .el-dropdown-menu,
  .el-dropdown-menu {
    background: transparent !important;
    padding: 4px 6px !important;
    border: none !important;
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-color-primary) !important;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;

    .el-icon,
    .el-icon {
      font-size: var(--font-size-subtitle);
      color: var(--accent-cyan);
      transition: color 0.2s ease;
    }

    &:hover,
    &:focus {
      background: rgba(var(--accent-cyan-rgb), 0.12) !important;
      color: var(--accent-cyan) !important;
      box-shadow: 0 0 10px rgba(var(--accent-cyan-rgb), 0.2);

      .el-icon,
      .el-icon {
        color: var(--accent-cyan);
      }
    }

    &.el-dropdown-menu__item--divided,
    &.el-dropdown-menu__item--divided {
      margin-top: 4px;
      border-top: 1px solid rgba(var(--accent-cyan-rgb), 0.15) !important;
    }
  }

  .user-logout-item {
    font-weight: var(--font-weight-semibold);
    color: var(--color-danger-soft) !important;

    .el-icon,
    .el-icon {
      font-size: var(--font-size-subtitle);
      color: var(--color-danger-strong);
      transition: color 0.2s ease;
    }

    &:hover,
    &:focus {
      background: var(--swatch-rgba-239-68-68-0_18) !important;
      color: var(--color-white) !important;
      box-shadow: 0 0 10px var(--swatch-rgba-239-68-68-0_3);

      .el-icon,
      .el-icon {
        color: var(--color-white);
      }
    }
  }
}

/* 场景下拉菜单（Teleport 到 body） */
:global(.scene-selector-popper) {
  background: var(--swatch-rgba-8-24-48-0_98) !important;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.3) !important;
  box-shadow:
    0 8px 24px var(--swatch-rgba-0-0-0-0_6),
    0 0 14px rgba(var(--accent-cyan-rgb), 0.15) !important;
  backdrop-filter: blur(12px);
  border-radius: 6px !important;
  padding: 4px 0 !important;
  max-height: 360px;
  overflow-y: auto;

  .el-popper__arrow::before,
  .el-popper__arrow::before {
    background: var(--swatch-rgba-8-24-48-0_98) !important;
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.3) !important;
  }

  .el-dropdown-menu,
  .el-dropdown-menu {
    background: transparent !important;
    padding: 4px 6px !important;
    border: none !important;
  }

  .el-dropdown-menu__item,
  .el-dropdown-menu__item {
    color: var(--swatch-dbeafe) !important;
    border-radius: 4px;
    margin: 2px 0;

    &:hover,
    &:focus {
      background: rgba(var(--accent-cyan-rgb), 0.12) !important;
      color: var(--accent-cyan) !important;
    }

    &.is-active {
      background: rgba(var(--accent-cyan-rgb), 0.2) !important;
      color: var(--accent-cyan) !important;
      font-weight: var(--font-weight-bold);
    }

    &.is-disabled {
      color: var(--text-color-subtle) !important;
    }
  }
}
</style>
