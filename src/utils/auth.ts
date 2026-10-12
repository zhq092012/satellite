/**
 * 登录态本地存储与请求守卫：Token、用户、角色、权限、菜单的读写，
 * 以及 401 后锁定非登录请求、避免重复跳转登录页。
 */

const TOKEN_KEY = 'atlas-token'
const USER_KEY = 'atlas-user'
const ROLES_KEY = 'atlas-roles'
const PERMISSIONS_KEY = 'atlas-permissions'
const MENUS_KEY = 'atlas-menus'
const LOGIN_REQUEST_PATTERNS = ['/api/auth/login', '/login']

/** 非登录接口是否在鉴权失败后处于锁定状态 */
let requestLocked = false
/** 是否已触发过一次登录页重定向（防并发 401 重复跳转） */
let loginRedirectTriggered = false

/** @returns 当前环境是否可用 localStorage */
function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

/** @param value 待序列化对象 */
function toJson<T>(value: T) {
  return JSON.stringify(value)
}

/**
 * @param value localStorage 字符串
 * @param fallback 解析失败或空值时的默认值
 */
function fromJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * 读取访问令牌。
 *
 * @returns Bearer Token 字符串；无则为空串
 */
export function getToken() {
  if (!canUseStorage()) {
    return ''
  }

  return localStorage.getItem(TOKEN_KEY) ?? ''
}

/**
 * 写入访问令牌。
 *
 * @param token 登录接口返回的 token
 */
export function setToken(token: string) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * 读取缓存的用户信息。
 *
 * @returns 用户对象；无缓存时为 null
 */
export function getStoredUser<T = unknown>() {
  if (!canUseStorage()) {
    return null as T | null
  }

  return fromJson<T | null>(localStorage.getItem(USER_KEY), null)
}

/**
 * 写入或清除用户信息。
 *
 * @param value 用户对象；null 表示清除
 */
export function setStoredUser<T>(value: T | null) {
  if (!canUseStorage()) {
    return
  }

  if (value === null || value === undefined) {
    localStorage.removeItem(USER_KEY)
    return
  }

  localStorage.setItem(USER_KEY, toJson(value))
}

/**
 * 读取角色编码列表。
 *
 * @returns 角色字符串数组
 */
export function getStoredRoles() {
  if (!canUseStorage()) {
    return [] as string[]
  }

  return fromJson<string[]>(localStorage.getItem(ROLES_KEY), [])
}

/** @param value 角色列表 */
export function setStoredRoles(value: string[]) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(ROLES_KEY, toJson(value))
}

/**
 * 读取权限码列表。
 *
 * @returns 权限字符串数组
 */
export function getStoredPermissions() {
  if (!canUseStorage()) {
    return [] as string[]
  }

  return fromJson<string[]>(localStorage.getItem(PERMISSIONS_KEY), [])
}

/** @param value 权限列表 */
export function setStoredPermissions(value: string[]) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(PERMISSIONS_KEY, toJson(value))
}

/**
 * 读取菜单树缓存。
 *
 * @returns 菜单树（结构由登录接口约定）
 */
export function getStoredMenus<T = unknown[]>() {
  if (!canUseStorage()) {
    return [] as T
  }

  return fromJson<T>(localStorage.getItem(MENUS_KEY), [] as T)
}

/** @param value 菜单树 */
export function setStoredMenus<T>(value: T) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(MENUS_KEY, toJson(value))
}

/** 清除全部鉴权相关 localStorage 项（退出登录时调用） */
export function clearAuthStorage() {
  if (!canUseStorage()) {
    return
  }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ROLES_KEY)
  localStorage.removeItem(PERMISSIONS_KEY)
  localStorage.removeItem(MENUS_KEY)
}

/**
 * 判断请求 URL 是否为登录接口（锁定期间仍允许登录）。
 *
 * @param url 请求 path 或完整 URL
 */
export function isLoginRequest(url: string = '') {
  return LOGIN_REQUEST_PATTERNS.some((pattern) => url.includes(pattern))
}

/** @returns 鉴权失败后是否已锁定普通 API 请求 */
export function isRequestLocked() {
  return requestLocked
}

/** 锁定非登录请求（通常在 401 拦截器中调用） */
export function lockRequests() {
  requestLocked = true
}

/** 登录成功后重置锁定与重定向标记 */
export function resetRequestGuard() {
  requestLocked = false
  loginRedirectTriggered = false
}

/** @returns 是否仍应执行跳转登录（尚未触发过） */
export function shouldRedirectToLogin() {
  return !loginRedirectTriggered
}

/** 标记已触发登录页重定向，避免多个 401 并发跳转 */
export function markLoginRedirectTriggered() {
  loginRedirectTriggered = true
}
