import { requestAPI } from '@/utils/tools/request'
import type { AxiosResponseType } from '@/types/http'

/** 菜单节点。树形接口里 children 挂子菜单。 */
export interface MenuItem {
  /** 菜单 ID */
  id: number
  /** 菜单名称 */
  menuName: string
  /** 路由路径 */
  path: string
  /** 前端组件路径 */
  component: string
  /** 菜单图标 */
  icon: string
  /** 菜单类型 */
  type: number
  /** 父级菜单 ID */
  parentId: number
  /** 排序号 */
  sort: number
  /** 权限标识 */
  permission: string
  /** 子菜单 */
  children: MenuItem[]
}
/** 角色详情。 */
export interface RoleInfo {
  /** 角色 ID */
  id: number
  /** 角色名称 */
  roleName: string
  /** 角色编码 */
  roleCode: string
  /** 角色说明 */
  description: string
  /** 角色状态，0 停用、1 启用 */
  status: number
  /** 创建时间，按年、月、日、时、分、秒等分量组成的数组 */
  createTime: number[]
  /** 更新时间，按年、月、日、时、分、秒等分量组成的数组 */
  updateTime: number[]
  /** 逻辑删除标记，0 表示未删除 */
  deleted: number
}
/** 用户详情。createTime、updateTime 为时间分量数组。 */
export interface UserInfo {
  /** 用户 ID */
  id: number
  /** 用户名 */
  username: string
  /** 登录密码 */
  password: string
  /** 昵称 */
  nickname: string
  /** 邮箱 */
  email: string
  /** 手机号 */
  phone: string
  /** 账号状态，0 停用、1 启用 */
  status: number
  /** 创建时间，按年、月、日、时、分、秒等分量组成的数组 */
  createTime: number[]
  /** 更新时间，按年、月、日、时、分、秒等分量组成的数组 */
  updateTime: number[]
  /** 逻辑删除标记，0 表示未删除 */
  deleted: number
}

/** 权限菜单。结构与菜单接近，并带状态和审计字段。 */
export interface PermissionInfo {
  /** 权限菜单 ID */
  id: number
  /** 菜单名称 */
  menuName: string
  /** 路由路径 */
  path: string
  /** 前端组件路径 */
  component: string
  /** 菜单图标 */
  icon: string
  /** 菜单类型 */
  type: number
  /** 父级菜单 ID */
  parentId: number
  /** 排序号 */
  sort: number
  /** 权限标识 */
  permission: string
  /** 权限状态，0 停用、1 启用 */
  status: number
  /** 创建时间，按年、月、日、时、分、秒等分量组成的数组 */
  createTime: number[]
  /** 更新时间，按年、月、日、时、分、秒等分量组成的数组 */
  updateTime: number[]
  /** 逻辑删除标记，0 表示未删除 */
  deleted: number
}
/** 登录成功后返回的用户、角色、权限、菜单和令牌。 */
export interface LoginResponse {
  /** 当前登录用户 */
  userInfo: UserInfo
  /** 用户拥有的角色 */
  role: RoleInfo[]
  /** 权限菜单列表 */
  permissions: PermissionInfo[]
  /** 当前用户可见的菜单树 */
  menuTree: MenuItem[]
  /** 登录令牌 */
  token: string
}
/** 分页列表。records 为当前页数据。 */
interface PageListResponse<T> {
  /** 当前页数据 */
  records: T[]
  /** 总条数 */
  total: number
  /** 总条数。部分分页接口用该字段返回总数 */
  totalElements?: number
  /** 每页条数 */
  size: number
  /** 当前页码 */
  current: number
  /** 总页数 */
  pages: number
}

/** 用户列表中的一行，含已分配角色。 */
export interface UserListItem {
  /** 用户 ID */
  id: number
  /** 用户名 */
  username: string
  /** 昵称 */
  nickname: string
  /** 邮箱 */
  email: string
  /** 手机号 */
  phone: string
  /** 账号状态，0 停用、1 启用 */
  status: number
  /** 创建时间 */
  createTime: string
  /** 更新时间 */
  updateTime: string
  /** 已分配的角色 */
  roles: RoleInfo[]
}

/** 角色列表中的一行。 */
export interface RoleListItem {
  /** 角色 ID */
  id: number
  /** 角色名称 */
  roleName: string
  /** 角色编码 */
  roleCode: string
  /** 角色说明 */
  description: string
  /** 角色状态，0 停用、1 启用 */
  status: number
  /** 创建时间 */
  createTime: string
  /** 更新时间 */
  updateTime: string
  /** 逻辑删除标记，0 表示未删除 */
  deleted: number
}

/** 创建用户的请求体。不含 id 和审计字段，密码与角色可选。 */
export type UserUpsertPayload = Omit<UserInfo, 'id' | 'password' | 'createTime' | 'updateTime' | 'deleted'> & {
  /** 初始密码。不传时由后端决定是否生成 */
  password?: string
  /** 要分配的角色 ID */
  roleIds?: number[]
}

/** 创建角色的请求体。不含 id 和审计字段，可同时提交菜单。 */
export type RoleUpsertPayload = Omit<RoleInfo, 'id' | 'createTime' | 'updateTime' | 'deleted'> & {
  /** 要分配的菜单 ID */
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

/**
 * 删除角色。
 * @param id 角色 ID
 * @returns 删除结果
 */
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
/**
 * 更新菜单。
 * @param data 菜单字段，必须包含 id
 * @returns 更新结果
 */
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
