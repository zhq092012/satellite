const TOKEN_KEY = 'atlas-token'
const USER_KEY = 'atlas-user'
const ROLES_KEY = 'atlas-roles'
const PERMISSIONS_KEY = 'atlas-permissions'
const MENUS_KEY = 'atlas-menus'
const LOGIN_REQUEST_PATTERNS = ['/api/auth/login', '/login']

let requestLocked = false
let loginRedirectTriggered = false

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function toJson<T>(value: T) {
  return JSON.stringify(value)
}

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

export function getToken() {
  if (!canUseStorage()) {
    return ''
  }

  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(TOKEN_KEY, token)
}

export function getStoredUser<T = unknown>() {
  if (!canUseStorage()) {
    return null as T | null
  }

  return fromJson<T | null>(localStorage.getItem(USER_KEY), null)
}

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

export function getStoredRoles() {
  if (!canUseStorage()) {
    return [] as string[]
  }

  return fromJson<string[]>(localStorage.getItem(ROLES_KEY), [])
}

export function setStoredRoles(value: string[]) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(ROLES_KEY, toJson(value))
}

export function getStoredPermissions() {
  if (!canUseStorage()) {
    return [] as string[]
  }

  return fromJson<string[]>(localStorage.getItem(PERMISSIONS_KEY), [])
}

export function setStoredPermissions(value: string[]) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(PERMISSIONS_KEY, toJson(value))
}

export function getStoredMenus<T = unknown[]>() {
  if (!canUseStorage()) {
    return [] as T
  }

  return fromJson<T>(localStorage.getItem(MENUS_KEY), [] as T)
}

export function setStoredMenus<T>(value: T) {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(MENUS_KEY, toJson(value))
}

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

export function isLoginRequest(url: string = '') {
  return LOGIN_REQUEST_PATTERNS.some((pattern) => url.includes(pattern))
}

export function isRequestLocked() {
  return requestLocked
}

export function lockRequests() {
  requestLocked = true
}

export function resetRequestGuard() {
  requestLocked = false
  loginRedirectTriggered = false
}

export function shouldRedirectToLogin() {
  return !loginRedirectTriggered
}

export function markLoginRedirectTriggered() {
  loginRedirectTriggered = true
}
