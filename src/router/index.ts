import { createWebHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'
import { ElMessage } from 'element-plus'
import { hasPermission, hasRole } from '@/utils/permission'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: {
      title: '登录',
      public: true,
      showInMenu: false,
    },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/layout/Dashboard.vue'),
    redirect: '/home',
    meta: {
      title: '首页',
      icon: 'HomeFilled',
      requiresAuth: true,
      showInMenu: true,
    },
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '整体态势分析',
          icon: 'icon-situation',
          showInMenu: true,
        },
      },
      {
        path: 'situation',
        name: 'Situation',
        component: () => import('@/components/BattleSituation/BattleSituation.vue'),
        meta: {
          title: '战场态势分析',
          icon: 'icon-situation',
          showInMenu: true,
        },
      },
      {
        path: 'system',
        name: 'SystemManage',
        component: () => import('@/layout/SystemManage.vue'),
        beforeEnter: (to: { path: string }) => {
          if (to.path === '/system') {
            return '/system/users'
          }
          return true
        },
        meta: {
          title: '系统管理',
          icon: 'icon-yunweizhishichouqu',
          showInMenu: true,
          requiresAuth: true,
          roles: ['admin'],
        },
        children: [
          {
            path: 'users',
            name: 'UserManage',
            component: () => import('@/views/admin/UserManage.vue'),
            meta: {
              title: '用户管理',
              icon: 'icon-us',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
          {
            path: 'roles',
            name: 'RoleManage',
            component: () => import('@/views/admin/RoleManage.vue'),
            meta: {
              title: '角色管理',
              icon: 'icon-jurassic_data',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
          {
            path: 'menus',
            name: 'MenuManage',
            component: () => import('@/views/admin/MenuManage.vue'),
            meta: {
              title: '菜单管理',
              icon: 'icon-layer',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
          {
            path: 'satellites',
            name: 'SatelliteManage',
            component: () => import('@/views/satellites/SatelliteList.vue'),
            meta: {
              title: '卫星管理',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
          {
            path: 'weapons',
            name: 'WeaponManage',
            component: () => import('@/views/weapons/WeaponList.vue'),
            meta: {
              title: '武器管理',
              icon: 'icon-sword',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:weapon:list',
            },
          },
          {
            path: 'basestations',
            name: 'BaseStationManage',
            component: () => import('@/views/basestations/BaseStationList.vue'),
            meta: {
              title: '基站管理',
              icon: 'icon-basestation',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:basestations:list',
            },
          },
          {
            path: 'missiles',
            name: 'MissileManage',
            component: () => import('@/views/weapons/MissileList.vue'),
            meta: {
              title: '导弹管理',
              icon: 'icon-missile',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:missiles:list',
            },
          },
          {
            path: 'missileBases',
            name: 'MissileBaseManage',
            component: () => import('@/views/weapons/MissileBase.vue'),
            meta: {
              title: '基地管理',
              icon: 'icon-missile-base',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:missileBases:list',
            },
          },
          {
            path: 'battles',
            name: 'BattleManage',
            component: () => import('@/views/admin/BattleManage.vue'),
            meta: {
              title: '战场管理',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
        ],
      },
      {
        path: 'algorithm',
        name: 'AlgorithmManage',
        component: () => import('@/layout/AlgorithmManage.vue'),
        redirect: '/algorithm/threat',
        beforeEnter: (to: { path: string }) => {
          if (to.path === '/algorithm') {
            return '/algorithm/threat'
          }
          return true
        },
        meta: {
          title: '算法分析管理',
          icon: 'icon-layer',
          showInMenu: true,
          requiresAuth: true,
        },
        children: [
          {
            path: 'threat',
            name: 'SatelliteThreat',
            component: () => import('@/views/algorithm/SatelliteThreat.vue'),
            meta: {
              title: '卫星威胁分析',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
            },
          },
          {
            path: 'attackability',
            name: 'SatelliteAttackability',
            component: () => import('@/views/algorithm/SatelliteAttackability.vue'),
            meta: {
              title: '可打击度分析',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
            },
          },
          {
            path: 'killchain',
            name: 'KillChainPlan',
            component: () => import('@/views/algorithm/KillChainPlan.vue'),
            meta: {
              title: '杀伤链方案',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
            },
          },
          {
            path: 'evaluation',
            name: 'EvaluationResult',
            component: () => import('@/views/algorithm/EvaluationResult.vue'),
            meta: {
              title: '打击结果评估',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
            },
          },
          {
            path: 'simulation',
            name: 'StrikeSimulation',
            component: () => import('@/views/algorithm/StrikeSimulation.vue'),
            meta: {
              title: '打击方案仿真',
              icon: 'icon-situation',
              showInMenu: true,
              requiresAuth: true,
            },
          },
        ],
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_ROUTER),
  routes,
})

import { useLayoutStore } from '@/store/modules/layout'

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const layoutStore = useLayoutStore()
  const requiredRoles = (to.meta.roles as string[] | undefined) ?? []
  const routeMeta = to.meta as { permission?: string; permissions?: string[] }
  const isAdmin = authStore.roles.includes('admin')

  // 未选择任务时，禁止访问算法管理相关子菜单与路由
  if (to.path.startsWith('/algorithm')) {
    if (!layoutStore.activedTask) {
      ElMessage.warning('尚未选择战场任务，请先在首页选择战场及任务！')
      return '/home'
    }
  }

  if (requiredRoles.length > 0 && !hasRole(authStore.roles, requiredRoles)) {
    ElMessage.warning('您没有权限访问该页面')
    return '/home'
  }

  const requiredPermissions = routeMeta.permissions ?? (routeMeta.permission ? [routeMeta.permission] : [])
  if (!isAdmin && requiredPermissions.length > 0 && !hasPermission(authStore.permissions, requiredPermissions)) {
    ElMessage.warning('您没有权限访问该页面')
    return '/home'
  }

  return true
})

export default router
