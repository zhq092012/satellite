import type { RouteRecordRaw } from 'vue-router'

function normalizeRoles(roles: Array<string | null | undefined> = []) {
  return roles.filter((role): role is string => !!role)
}

function normalizePermissions(permissions: Array<string | null | undefined> = []) {
  return permissions.filter((permission): permission is string => !!permission)
}

export function hasRole(userRoles: string[] = [], requiredRoles: string[] = []) {
  const normalizedRequiredRoles = normalizeRoles(requiredRoles)

  if (normalizedRequiredRoles.length === 0) {
    return true
  }

  const normalizedUserRoles = normalizeRoles(userRoles)
  return normalizedRequiredRoles.some((role) => normalizedUserRoles.includes(role))
}

export function hasPermission(userPermissions: string[] = [], requiredPermissions: string[] = []) {
  const normalizedRequiredPermissions = normalizePermissions(requiredPermissions)

  if (normalizedRequiredPermissions.length === 0) {
    return true
  }

  const normalizedUserPermissions = normalizePermissions(userPermissions)
  return normalizedRequiredPermissions.some((permission) => normalizedUserPermissions.includes(permission))
}

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
