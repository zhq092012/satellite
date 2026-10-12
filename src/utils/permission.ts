/**
 * 路由与按钮级权限辅助：基于角色、权限码过滤菜单与路由。
 */

import type { RouteRecordRaw } from 'vue-router'

/** 过滤空角色字符串 */
function normalizeRoles(roles: Array<string | null | undefined> = []) {
  return roles.filter((role): role is string => !!role)
}

/** 过滤空权限字符串 */
function normalizePermissions(permissions: Array<string | null | undefined> = []) {
  return permissions.filter((permission): permission is string => !!permission)
}

/**
 * 判断用户是否具备所需角色之一。
 *
 * @param userRoles 当前用户角色
 * @param requiredRoles 路由 meta.roles；空数组表示不限制
 * @returns 满足任一 requiredRoles 时为 true
 */
export function hasRole(userRoles: string[] = [], requiredRoles: string[] = []) {
  const normalizedRequiredRoles = normalizeRoles(requiredRoles)

  if (normalizedRequiredRoles.length === 0) {
    return true
  }

  const normalizedUserRoles = normalizeRoles(userRoles)
  return normalizedRequiredRoles.some((role) => normalizedUserRoles.includes(role))
}

/**
 * 判断用户是否具备所需权限之一。
 *
 * @param userPermissions 当前用户权限码
 * @param requiredPermissions 路由 meta.permissions；空数组表示不限制
 * @returns 满足任一 requiredPermissions 时为 true
 */
export function hasPermission(userPermissions: string[] = [], requiredPermissions: string[] = []) {
  const normalizedRequiredPermissions = normalizePermissions(requiredPermissions)

  if (normalizedRequiredPermissions.length === 0) {
    return true
  }

  const normalizedUserPermissions = normalizePermissions(userPermissions)
  return normalizedRequiredPermissions.some((permission) => normalizedUserPermissions.includes(permission))
}

/**
 * 按角色递归过滤路由树（无权限的节点整支移除）。
 *
 * @param routes 待过滤路由
 * @param userRoles 当前用户角色
 * @returns 过滤后的路由副本
 */
export function filterRoutesByRoles(routes: RouteRecordRaw[], userRoles: string[] = []) {
  return routes
    .map((route: any) => {
      const routeRoles = (route.meta?.roles as string[] | undefined) ?? []
      const children: any = route.children ? filterRoutesByRoles(route.children, userRoles) : undefined

      if (!hasRole(userRoles, routeRoles)) {
        return null
      }

      return {
        ...route,
        children,
      }
    })
    .filter((route): route is RouteRecordRaw => route !== null)
}
