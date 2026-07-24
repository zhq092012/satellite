import { requestAPI } from '@/utils/http/request'
import type { AxiosResponseType } from '@/types/http'

export interface MenuItem {
  id: number
  menuName: string
  path: string
  component: string
  icon: string
  type: number
  parentId: number
  sort: number
  permission: string
  children: MenuItem[]
}
export interface RoleInfo {
  id: number
  roleName: string
  roleCode: string
  description: string
  status: number
  createTime: number[]
  updateTime: number[]
  deleted: number
}
export interface UserInfo {
  id: number
  username: string
  password: string
  nickname: string
  email: string
  phone: string
  status: number
  createTime: number[]
  updateTime: number[]
  deleted: number
}

export interface PermissionInfo {
  id: number
  menuName: string
  path: string
  component: string
  icon: string
  type: number
  parentId: number
  sort: number
  permission: string
  status: number
  createTime: number[]
  updateTime: number[]
  deleted: number
}
export interface LoginResponse {
  userInfo: UserInfo
  role: RoleInfo[]
  permissions: PermissionInfo[]
  menuTree: MenuItem[]
  token: string
}
interface PageListResponse<T> {
  records: T[]
  total: number
  totalElements?: number
  size: number
  current: number
  pages: number
}

export interface UserListItem {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  status: number
  createTime: string
  updateTime: string
  roles: RoleInfo[]
}

export interface RoleListItem {
  id: number
  roleName: string
  roleCode: string
  description: string
  status: number
  createTime: string
  updateTime: string
  deleted: number
}

export type UserUpsertPayload = Omit<UserInfo, 'id' | 'password' | 'createTime' | 'updateTime' | 'deleted'> & {
  password?: string
  roleIds?: number[]
}

export type RoleUpsertPayload = Omit<RoleInfo, 'id' | 'createTime' | 'updateTime' | 'deleted'> & {
  menuIds?: number[]
}

// 用户列表分页响应类型
export type UserPageList = PageListResponse<UserListItem>

// 角色列表分页响应类型
export type RolePageList = PageListResponse<RoleListItem>

/**
 * 登录
 * @param data
 * @returns
 */
export const login = (data: { username: string; password: string }) => {
  return requestAPI.post<AxiosResponseType<LoginResponse>>('/api/auth/login', data)
}
/**
 * 登出
 * @returns
 */
export const logout = () => {
  return requestAPI.post<AxiosResponseType<unknown>>('/api/auth/logout')
}
/**
 * 获取菜单树
 * @returns
 */
export const getMenuTree = () => {
  return requestAPI.get<AxiosResponseType<MenuItem[]>>('/api/system/menus/tree')
}

// ---------- user ----------
/**
 * 更新用户信息
 * @param data 用户对象，包含更新字段
 */
export const updateUser = (data: Partial<UserInfo> & { roleIds?: number[] }) => {
  return requestAPI.put<AxiosResponseType<any>>('/api/user', data)
}

/**
 * 创建新用户
 * @param data 用户对象，不包含 id
 */
export const createUser = (data: UserUpsertPayload) => {
  return requestAPI.post<AxiosResponseType<any>>('/api/user', data)
}

/**
 * 为用户分配角色
 * @param id 用户 ID
 * @param roleIds 角色 ID 数组
 */
export const assignRolesToUser = (id: number, roleIds: number[]) => {
  return requestAPI.post<AxiosResponseType<any>>(`/api/user/${id}/roles`, { roleIds })
}
/**
 * 重置用户密码（管理员操作）
 * @param data 包含 userId 和新密码
 */
export const resetUserPassword = (data: { userId: number }) => {
  return requestAPI.post<AxiosResponseType<any>>('/api/user/resetPwd', data)
}

/**
 * 修改当前用户密码
 * @param data 包含 userId、旧密码和新密码
 */
export const changeUserPassword = (data: { userId: number; oldPassword: string; newPassword: string }) => {
  return requestAPI.post<AxiosResponseType<any>>('/api/user/changePwd', data)
}

/**
 * 根据用户ID获取用户详情
 * @param id 用户ID
 */
export const getUserById = (id: number) => {
  return requestAPI.get<AxiosResponseType<UserInfo>>(`/api/user/${id}`)
}

/**
 * 删除用户
 * @param id 用户ID
 */
export const deleteUser = (id: number) => {
  return requestAPI.delete<AxiosResponseType<any>>(`/api/user/${id}`)
}

/**
 * 获取用户列表（分页）
 * @param params 查询参数: username, nickname, status, page, size
 */
export const getUserList = (params?: {
  username: string
  nickname: string
  status: number
  page: number
  size: number
}) => {
  return requestAPI.get<AxiosResponseType<UserPageList>>('/api/user/list', params)
}

/**
 * 获取当前登录用户信息
 */
export const getCurrentUserInfo = () => {
  return requestAPI.get<AxiosResponseType<UserInfo>>('/api/user/info')
}

// ---------- role ----------
/**
 * 更新角色信息
 * @param data 角色数据，必须包含 id
 */
export const updateRole = (data: Partial<RoleInfo> & { id: number; menuIds?: number[] }) => {
  return requestAPI.put<AxiosResponseType<any>>('/api/role', data)
}

/**
 * 创建角色
 * @param data 角色对象，不包含 id
 */
export const createRole = (data: RoleUpsertPayload) => {
  return requestAPI.post<AxiosResponseType<any>>('/api/role', data)
}

/**
 * 获取角色关联的菜单ID数组
 * @param id 角色ID
 */
export const getRoleMenus = (id: number) => {
  return requestAPI.get<AxiosResponseType<number[]>>(`/api/role/${id}/menus`)
}
/**
 * 为角色分配菜单
 * @param id
 * @param menuIds
 * @returns
 */
/**
 * 为角色分配菜单
 * @param id 角色ID
 * @param menuIds 菜单 ID 数组
 */
export const assignMenusToRole = (id: number, menuIds: number[]) => {
  return requestAPI.post<AxiosResponseType<any>>(`/api/role/${id}/menus`, menuIds)
}

/**
 * 根据角色ID获取角色信息
 * @param id 角色ID
 */
export const getRoleById = (id: number) => {
  return requestAPI.get<AxiosResponseType<RoleInfo>>(`/api/role/${id}`)
}

export const deleteRole = (id: number) => {
  return requestAPI.delete<AxiosResponseType<any>>(`/api/role/${id}`)
}

/**
 * 获取角色列表（分页）
 * @param params 可选查询参数
 */
export const getRoleList = (params?: Record<string, any>) => {
  return requestAPI.get<AxiosResponseType<RolePageList>>('/api/role/list', params)
}

// ---------- menu ----------
export const updateMenu = (data: Partial<MenuItem> & { id: number }) => {
  return requestAPI.put<AxiosResponseType<any>>('/api/menu', data)
}

/**
 * 创建菜单
 * @param data 菜单数据
 */
export const createMenu = (data: Omit<MenuItem, 'id' | 'children'>) => {
  return requestAPI.post<AxiosResponseType<any>>('/api/menu', data)
}

/**
 * 根据菜单ID获取菜单信息
 * @param id 菜单ID
 */
export const getMenuById = (id: number) => {
  return requestAPI.get<AxiosResponseType<MenuItem>>(`/api/menu/${id}`)
}

/**
 * 删除菜单
 * @param id 菜单ID
 */
export const deleteMenu = (id: number) => {
  return requestAPI.delete<AxiosResponseType<any>>(`/api/menu/${id}`)
}

/**
 * 获取指定用户的授权菜单列表
 * @param userId 用户ID
 */
export const getUserMenuByUserId = (userId: number) => {
  return requestAPI.get<AxiosResponseType<MenuItem[]>>(`/api/menu/user/${userId}`)
}

/**
 * 获取所有菜单（不区分用户权限）
 */
export const getAllMenus = () => {
  return requestAPI.get<AxiosResponseType<MenuItem[]>>('/api/menu/all')
}
