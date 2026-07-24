import type { HttpRequestOptions } from '@/types/http'
import router from '@/router'
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElLoading, ElMessage, type LoadingInstance } from 'element-plus'
import {
  getToken,
  isLoginRequest,
  isRequestLocked,
  lockRequests,
  markLoginRedirectTriggered,
  shouldRedirectToLogin,
} from '../auth'
type RequestMethods = 'get' | 'post' | 'put' | 'delete'

type RequestExtraOptions = {
  hasLoading?: boolean
  loadingText?: string
}

type HttpConfig = AxiosRequestConfig & RequestExtraOptions

/**
 * HTTP请求类，用于封装Axios的配置和拦截器设置
 */
class HttpRequest {
  private readonly baseURL: string
  private readonly timeout: number
  private axiosInstance: AxiosInstance
  /**
   * HttpRequst构造函数
   * @param options 其他请求配置
   */
  constructor(options: HttpRequestOptions) {
    this.baseURL = options.baseUrl || import.meta.env.VITE_API_BASE_URL
    this.timeout = options.timeout || 30 * 60 * 1000
    this.axiosInstance = this.createAxiosInstance(options.headers)
  }

  /**
   * 创建axios实例并配置拦截器
   */
  private createAxiosInstance(headers: Record<string, unknown> = {}): AxiosInstance {
    const instance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })

    this.setupInterceptors(instance)
    return instance
  }

  /**
   * 配置拦截器
   */
  private setupInterceptors(instance: AxiosInstance): void {
    // 请求拦截器
    instance.interceptors.request.use(
      (config) => {
        const reqUrl = config.url || ''
        if (isRequestLocked() && !isLoginRequest(reqUrl)) {
          return Promise.reject(new Error('AUTH_LOCKED'))
        }

        // 添加时间戳，避免缓存
        if (config.method === 'get') {
          config.params = { ...config.params }
        } else {
          if (config.data instanceof FormData) {
            config.data = config.data
          } else {
            config.data = Array.isArray(config.data) ? config.data : { ...config.data }
          }
        }

        const token = getToken()
        if (token) {
          config.headers = config.headers ?? {}
          config.headers!.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        ElMessage.error('请求配置错误：' + error.message)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const { status, data } = response
        if (status === 200 || status === 201 || status === 204) {
          return data
        } else {
          ElMessage.error(`请求失败：${status}`)
          return Promise.reject(new Error(`HTTP状态码：${status}`))
        }
      },
      (error) => {
        // 错误处理
        if (error.response) {
          const { status } = error.response
          const reqUrl = (error.response && error.response.config && error.response.config.url) || ''
          const isLoginApi = typeof reqUrl === 'string' && isLoginRequest(reqUrl)
          const onLoginPage = router.currentRoute.value.path === '/login'

          switch (status) {
            case 401:
              if (!isLoginApi) {
                lockRequests()

                // 只在首次 401 时跳转，避免并发请求重复触发路由跳转
                if (!onLoginPage && shouldRedirectToLogin()) {
                  markLoginRedirectTriggered()
                  void router.replace('/login').catch(() => {})
                }
              }
              break
            case 403:
              ElMessage.error('拒绝访问')
              break
            case 404:
              ElMessage.error('请求的资源不存在')
              break
            case 409:
              ElMessage.error('请求的资源不存在')
              break
            case 500:
              ElMessage.error('服务器错误')
              break
            default:
              ElMessage.error(`请求失败：${error.message}`)
          }
        } else if (error.request) {
          ElMessage.error('网络错误，请检查您的网络连接')
        } else {
          ElMessage.error(`请求错误：${error.message}`)
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * 创建请求配置
   */
  private createRequestConfig(
    method: RequestMethods,
    url: string,
    data?: any,
    headers: Record<string, string> = {},
    options: RequestExtraOptions = {}
  ): HttpConfig {
    const config: HttpConfig = {
      url,
      method,
      headers: {
        ...headers,
      },
      ...options,
    }

    if (method === 'get') {
      config.params = data
    } else {
      config.data = data //post put delete方法
    }

    return config
  }

  /**
   * 发送请求的通用方法
   * @param config 请求配置，包括URL、方法、数据、请求头和额外选项
   * @returns 请求结果的Promise
   */
  private async request<T = unknown>(config: HttpConfig): Promise<T> {
    let loadingInstance: LoadingInstance | null = null
    const { hasLoading, loadingText, ...axiosConfig } = config

    if (hasLoading) {
      loadingInstance = ElLoading.service({
        lock: true,
        text: loadingText || '加载中...',
        background: 'rgba(0, 0, 0, 0.35)',
      })
    }

    try {
      return await this.axiosInstance.request<unknown, T>(axiosConfig)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loadingInstance?.close()
    }
  }

  /**
   * GET请求
   * @param url 请求URL
   * @param params 查询参数
   * @param headers 请求头
   * @param options 额外请求选项，如是否显示加载动画等
   * @returns 请求结果的Promise
   */
  public get<T = unknown>(
    url: string,
    params?: any,
    headers: Record<string, string> = {},
    options: RequestExtraOptions = {}
  ): Promise<T> {
    return this.request<T>(this.createRequestConfig('get', url, params, headers, options))
  }

  /**
   * POST请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param headers 请求头
   * @param options 额外请求选项，如是否显示加载动画等
   * @returns 请求结果的Promise
   */
  public post<T = unknown>(
    url: string,
    data?: any,
    headers: Record<string, string> = {},
    options: RequestExtraOptions = {}
  ): Promise<T> {
    return this.request<T>(this.createRequestConfig('post', url, data, headers, options))
  }

  /**
   * PUT请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param headers 请求头
   * @param options 额外请求选项，如是否显示加载动画等
   * @returns 请求结果的Promise
   */
  public put<T = unknown>(
    url: string,
    data?: any,
    headers: Record<string, string> = {},
    options: RequestExtraOptions = {}
  ): Promise<T> {
    return this.request<T>(this.createRequestConfig('put', url, data, headers, options))
  }

  /**
   * DELETE请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param headers 请求头
   * @param options 额外请求选项，如是否显示加载动画等
   * @returns 请求结果的Promise
   */
  public delete<T = unknown>(
    url: string,
    data?: any,
    headers: Record<string, string> = {},
    options: RequestExtraOptions = {}
  ): Promise<T> {
    return this.request<T>(this.createRequestConfig('delete', url, data, headers, options))
  }
}

/**
 * 请求后端API接口
 * baseUrl从环境变量中读取，默认使用VITE_API_BASE_URL
 * 默认请求头为Content-Type: application/json
 */
const requestAPI = new HttpRequest({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export { requestAPI }
