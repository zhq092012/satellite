import { defineStore } from 'pinia'
import type { LoginResponse, MenuItem, RoleInfo, UserInfo } from '@/api/auth'
import {
  clearAuthStorage,
  getStoredMenus,
  getStoredPermissions,
  getStoredRoles,
  getStoredUser,
  getToken,
  resetRequestGuard,
  setStoredMenus,
  setStoredPermissions,
  setStoredRoles,
  setStoredUser,
  setToken,
} from '@/utils/auth'

interface AuthState {
  token: string
  userInfo: UserInfo | null
  roles: string[]
  permissions: string[]
  menuTree: MenuItem[]
}

const normalizeRoles = (roles: RoleInfo[]) => roles.map((role) => role.roleCode).filter(Boolean)

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: getToken(),
    userInfo: getStoredUser<UserInfo>(),
    roles: getStoredRoles(),
    permissions: getStoredPermissions(),
    menuTree: getStoredMenus<MenuItem[]>(),
  }),

  getters: {
    isLogin: (state) => Boolean(state.token),
  },

  actions: {
    setToken(token: string) {
      this.token = token
      setToken(token)
    },

    setAuth(data: LoginResponse) {
      this.token = data.token
      this.userInfo = data.userInfo
      this.roles = normalizeRoles(data.role)
      this.permissions = data.permissions.map((permission) => permission.permission).filter(Boolean)
      this.menuTree = data.menuTree
      resetRequestGuard()

      setToken(data.token)
      setStoredUser(data.userInfo)
      setStoredRoles(this.roles)
      setStoredPermissions(this.permissions)
      setStoredMenus(this.menuTree)
    },

    logout() {
      this.token = ''
      this.userInfo = null
      this.roles = []
      this.permissions = []
      this.menuTree = []
      clearAuthStorage()
      resetRequestGuard()
    },
  },

  persist: {
    storage: localStorage,
    pick: ['token', 'userInfo', 'roles', 'permissions', 'menuTree'],
  },
})
