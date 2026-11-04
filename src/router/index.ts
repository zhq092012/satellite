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
        path: 'home/topo',
        name: 'HomeTopo',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '态势拓扑分析',
          icon: 'icon-situation',
          showInMenu: false,
        },
      },
      {
        path: 'home/gantt',
        name: 'HomeGantt',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '甘特图分析',
          icon: 'icon-situation',
          showInMenu: false,
        },
      },
      {
        path: 'home/windows',
        name: 'HomeWindows',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '打击窗口分析',
          icon: 'icon-situation',
          showInMenu: false,
        },
      },
      {
        path: 'home/strike-plan',
        name: 'HomeStrikePlan',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '打击方案管理',
          icon: 'icon-situation',
          showInMenu: false,
        },
      },
      {
        path: 'home/threat',
        name: 'HomeThreat',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '威胁度分析',
          icon: 'icon-situation',
          showInMenu: false,
        },
      },
      {
        path: 'home/attack',
        name: 'HomeAttack',
        component: () => import('@/layout/Home.vue'),
        meta: {
          title: '攻击度分析',
          icon: 'icon-situation',
          showInMenu: false,
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
        path: 'system/battles',
        redirect: '/data-manage/battles',
      },
      {
        path: 'system/satellites',
        redirect: '/data-manage/satellites',
      },
      {
        path: 'system/ground-stations',
        redirect: '/data-manage/ground-stations',
      },
      {
        path: 'system/data-centers',
        redirect: '/data-manage/data-centers',
      },
      {
        path: 'system/weapons',
        redirect: '/data-manage/weapons',
      },
      {
        path: 'data-manage/satellite-network',
        redirect: '/data-manage/satellites',
      },
      {
        path: 'system/satellite-network',
        redirect: '/data-manage/satellites',
      },
      {
        path: 'system/basestations',
        redirect: '/data-manage/ground-stations',
      },
      {
        path: 'system/missiles',
        redirect: '/data-manage/weapons',
      },
      {
        path: 'system/missileBases',
        redirect: '/data-manage/weapons',
      },
      {
        path: 'data-manage',
        name: 'DataManage',
        component: () => import('@/layout/DataManage.vue'),
        redirect: '/data-manage/battles',
        beforeEnter: (to: { path: string }) => {
          if (to.path === '/data-manage') {
            return '/data-manage/battles'
          }
          return true
        },
        meta: {
          title: '数据管理',
          icon: 'icon-layer',
          showInMenu: false,
          requiresAuth: true,
          roles: ['admin'],
        },
        children: [
          {
            path: 'battles',
            name: 'BattleManage',
            component: () => import('@/views/admin/BattleManage.vue'),
            meta: {
              title: '场景管理',
              icon: 'icon-situation',
              showInMenu: false,
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
              showInMenu: false,
              requiresAuth: true,
              roles: ['admin'],
            },
          },
          {
            path: 'ground-stations',
            name: 'GroundStationManage',
            component: () => import('@/views/basestations/BaseStationList.vue'),
            meta: {
              title: '地面站管理',
              icon: 'icon-basestation',
              showInMenu: false,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:basestations:list',
              stationScope: 'ground',
            },
          },
          {
            path: 'data-centers',
            name: 'DataCenterManage',
            component: () => import('@/views/basestations/BaseStationList.vue'),
            meta: {
              title: '数据中心管理',
              icon: 'icon-basestation',
              showInMenu: false,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:basestations:list',
              stationScope: 'center',
            },
          },
          {
            path: 'weapons',
            name: 'WeaponManage',
            component: () => import('@/views/weapons/WeaponList.vue'),
            meta: {
              title: '武器管理',
              icon: 'icon-sword',
              showInMenu: false,
              requiresAuth: true,
              roles: ['admin'],
              permission: 'system:weapon:list',
            },
          },
        ],
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
        ],
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_ROUTER),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiredRoles = (to.meta.roles as string[] | undefined) ?? []
  const routeMeta = to.meta as { permission?: string; permissions?: string[] }
  const isAdmin = authStore.roles.includes('admin')

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
