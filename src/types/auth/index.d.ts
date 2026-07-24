export interface IUser {
  /** 用户ID ，唯一标识符*/
  id: string
  /** 用户名 */
  username: string
  /** 加密后的密码 */
  password: string

  [key: string]: unknown
}

/**
 * 请求token
 */
export type TokenRequest = Pick<IUser, 'username' | 'password'> & {
  grant_type: string
  scope: string
  client_id: string
  client_secret: string
}
/**
 * Token类型
 */
export interface TokenResult {
  code: number
  access_token: string
  is_admin: boolean
  msg: string
}
