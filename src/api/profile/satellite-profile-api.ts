import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/request'

export interface SatelliteAdvantageOrDisadvantage {
  _id: string
  equipmentId: number
  equipmentName: string
  cognitionAdvantage: {
    title: string
    content: string
    keyFeatures: {
      featureName: string
      featureContent: string
    }[]
  }[]
  cognitionWeakness: {
    title: string
    content: string
    keyFeatures: {
      featureName: string
      featureContent: string
    }[]
  }[]
  derivativeModels: {
    derivativeName: string
    derivativeImage: string
    derivativeProcess: string
  }[]
}
/** 查询卫星画像 优势/劣势 */
export function getSatelliteProfileAdvantageOrDisadvantage(params: {
  /** 卫星id */
  satelliteId: number
  /** 卫星名称 */
  satelliteName: string
}): Promise<AxiosResponseType<SatelliteAdvantageOrDisadvantage>> {
  const url = `/api/satellite/advantage?noradId=${params.satelliteId}&name=${params.satelliteName}`
  return requestAPI.get(url)
}

/** 保存卫星画像 优势/劣势 */
export function saveSatelliteProfileAdvantageOrDisadvantage(
  data: SatelliteAdvantageOrDisadvantage
): Promise<AxiosResponseType<void>> {
  const url = `/api/satellite/advantage/save`
  return requestAPI.post(url, data)
}
export const IntelligenceTypeArr = ['图片', '视频', '文字', '音频', '其他']
export const IntelligenceSourceTypeArr = ['装备拍摄', '信号截获', '其他']
export type IntelligenceSourceType = (typeof IntelligenceSourceTypeArr)[number]
export type IntelligenceType = typeof IntelligenceTypeArr
export interface SatelliteProfileIntelligence {
  get_id: string
  norad: number
  title: string
  content: string
  source: string
  pubTime: string
  type: string
  sourceType: string
  img: string
  createTime: string
}

/**查询卫星情报分页列表 */
export function getSatelliteProfileIntelligenceList(params: {
  pageNum: number
  pageSize: number
  type: IntelligenceType | undefined
  sourceType: IntelligenceSourceType | undefined
  norad: number | undefined
}): Promise<AxiosResponsePage<SatelliteProfileIntelligence[]>> {
  let url = `/api/satellite/intelligence/pageQuery`
  return requestAPI.post(url, params)
}

/**上传卫星情报信息 multipart/form-data*/
export function uploadSatelliteProfileIntelligence(data: {
  intelligenceJson: string
  file?: File
}): Promise<AxiosResponseType<void>> {
  const url = `/api/satellite/intelligence/save`
  const formData = new FormData()
  formData.append('intelligenceJson', data.intelligenceJson)
  if (data.file) {
    formData.append('file', data.file)
  }
  return requestAPI.post(url, formData, {
    'Content-Type': 'multipart/form-data',
  })
}

/** 获取卫星新闻分页信息 */
export function getSatelliteProfileNewsList(params: {
  pageNum: number
  pageSize: number
}): Promise<AxiosResponsePage<{ title: string; content: string; pubTime: string; abstracts: string }[]>> {
  const url = `/api/satellite/news/pageQuery`
  return requestAPI.post(url, params)
}
