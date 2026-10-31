import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/httpClient'

/** 卫星画像中的认知优势、认知劣势和衍生型号。 */
export interface SatelliteAdvantageOrDisadvantage {
  /** 文档 ID */
  _id: string
  /** 装备编号，这里是卫星编号 */
  equipmentId: number
  /** 装备名称，这里是卫星名称 */
  equipmentName: string
  /** 认知优势列表 */
  cognitionAdvantage: {
    /** 优势条目标题 */
    title: string
    /** 优势条目正文 */
    content: string
    /** 优势条目的关键特征 */
    keyFeatures: {
      /** 特征名称 */
      featureName: string
      /** 特征说明 */
      featureContent: string
    }[]
  }[]
  /** 认知劣势列表 */
  cognitionWeakness: {
    /** 劣势条目标题 */
    title: string
    /** 劣势条目正文 */
    content: string
    /** 劣势条目的关键特征 */
    keyFeatures: {
      /** 特征名称 */
      featureName: string
      /** 特征说明 */
      featureContent: string
    }[]
  }[]
  /** 衍生型号列表 */
  derivativeModels: {
    /** 衍生型号名称 */
    derivativeName: string
    /** 衍生型号图片 */
    derivativeImage: string
    /** 衍生过程说明 */
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
/** 卫星情报类型可选值：图片、视频、文字、音频、其他。 */
export const IntelligenceTypeArr = ['图片', '视频', '文字', '音频', '其他']
/** 卫星情报来源可选值：装备拍摄、信号截获、其他。 */
export const IntelligenceSourceTypeArr = ['装备拍摄', '信号截获', '其他']
/** 情报来源字面量，取 IntelligenceSourceTypeArr 的单个元素。 */
export type IntelligenceSourceType = (typeof IntelligenceSourceTypeArr)[number]
/** 情报类型数组的类型，对应 IntelligenceTypeArr 整体，不是单个元素。 */
export type IntelligenceType = typeof IntelligenceTypeArr
/** 卫星情报记录。 */
export interface SatelliteProfileIntelligence {
  /** 情报文档 ID */
  get_id: string
  /** 卫星 NORAD 编号 */
  norad: number
  /** 情报标题 */
  title: string
  /** 情报正文 */
  content: string
  /** 情报来源 */
  source: string
  /** 发布时间 */
  pubTime: string
  /** 情报类型，取值为图片、视频、文字、音频或其他 */
  type: string
  /** 情报来源类型：装备拍摄、信号截获或其他 */
  sourceType: string
  /** 配图地址 */
  img: string
  /** 情报入库时间 */
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
