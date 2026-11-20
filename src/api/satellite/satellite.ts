import type { AxiosResponseType } from '@/types/http'
import type {
  SatelliteImportResult,
  SatelliteResource,
  SatelliteResourceListQuery,
  SatelliteResourceSearchQuery,
  SatelliteResourceUpsertPayload,
  SatelliteSeriesByCountryQuery,
  SatelliteSeriesData,
  SatelliteSeriesNameList,
  SatelliteTreeCountryNode,
} from '@/types/satellite/satellite'
import { requestAPI } from '@/utils/tools/request'
import { buildSatelliteSeriesDataFromSearchResults } from '@/utils/satelliteResource'
import { isResourceApiSuccess } from '@/utils/resourceApi'

export type {
  Satellite,
  SatelliteDetail,
  SatelliteImportResult,
  SatelliteInfo,
  SatelliteResource,
  SatelliteResourceListQuery,
  SatelliteResourceSearchQuery,
  SatelliteResourceUpsertPayload,
  SatelliteSeriesByCountryQuery,
  SatelliteSeriesData,
  SatelliteSeriesNameList,
  SatelliteTreeCountryNode,
  SatelliteAssembleTreeNode,
  SatelliteTreeSeriesNode,
  SatelliteTreeSystemNode,
  SatelliteTreeSatelliteLeaf,
  SatelliteTle,
  StepSatellite,
  TaskSteps,
} from '@/types/satellite/satellite'

const BASE = '/api/resource/satellite'

/**
 * 卫星列表（关键字模糊：NORAD / 代号 / 名称）。
 */
export const getSatelliteResourceList = (query: SatelliteResourceListQuery = {}) => {
  return requestAPI.get<AxiosResponseType<SatelliteResource[]>>(`${BASE}/list`, query)
}

/**
 * 按国家、体系、系列查询卫星列表。
 */
export const searchSatelliteResources = (query: SatelliteResourceSearchQuery = {}) => {
  return requestAPI.get<AxiosResponseType<SatelliteResource[]>>(`${BASE}/search`, query)
}

/**
 * 按国家列表查询卫星层级树：国家 → 体系 → 系列 → 卫星（OpenAPI `tree`）。
 *
 * @param countries 国家列表，须非空
 */
export const getSatelliteResourceTree = (countries: string[]) => {
  const list = countries.map((item) => item.trim()).filter(Boolean)
  if (!list.length) {
    return Promise.reject(new Error('查询卫星树时 countries 不能为空'))
  }
  return requestAPI.get<AxiosResponseType<SatelliteTreeCountryNode[]>>(`${BASE}/tree`, {
    countries: list.join(','),
  })
}

/**
 * 按国家查询该国所有卫星系列名称（OpenAPI `listSeriesByCountry`）。
 *
 * @param query `country` 必填
 * @returns `data` 为系列名称字符串数组
 */
export const listSatelliteSeriesByCountry = (query: SatelliteSeriesByCountryQuery) => {
  return requestAPI.get<AxiosResponseType<SatelliteSeriesNameList>>(`${BASE}/series`, query)
}

/**
 * 按国家查询系列名称（语义化包装，校验非空 `country`）。
 *
 * @param country 国家
 */
export const getSatelliteSeriesByCountry = (country: string) => {
  const trimmed = country.trim()
  if (!trimmed) {
    return Promise.reject(new Error('按国家查询卫星系列时 country 不能为空'))
  }
  return listSatelliteSeriesByCountry({ country: trimmed })
}

/**
 * 解析系列接口响应，得到去重排序后的系列名列表。
 *
 * @param country 国家（用于错误信息）
 * @param res 系列接口响应
 */
export function parseSatelliteSeriesByCountryResponse(
  country: string,
  res: AxiosResponseType<SatelliteSeriesNameList>,
): SatelliteSeriesNameList {
  if (!isResourceApiSuccess(res.code)) {
    throw new Error(res.msg || `查询卫星系列失败：country=${country}`)
  }
  return [...new Set((res.data ?? []).map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  )
}

/**
 * 按国家拉取系列名称列表（成功时返回解析结果，失败抛错）。
 *
 * @param country 国家
 */
export async function fetchSatelliteSeriesNamesByCountry(country: string): Promise<SatelliteSeriesNameList> {
  const trimmed = country.trim()
  if (!trimmed) {
    throw new Error('按国家查询卫星系列时 country 不能为空')
  }
  const res = await listSatelliteSeriesByCountry({ country: trimmed })
  return parseSatelliteSeriesByCountryResponse(trimmed, res)
}

/**
 * 卫星详情。
 *
 * @param id 记录 id
 */
export const getSatelliteResourceById = (id: string) => {
  return requestAPI.get<AxiosResponseType<SatelliteResource>>(`${BASE}/${id}`)
}

/**
 * 新增卫星。
 */
export const createSatelliteResource = (payload: SatelliteResourceUpsertPayload) => {
  return requestAPI.post<AxiosResponseType<string>>(BASE, payload)
}

/**
 * 修改卫星。请求体须包含 `id`。
 */
export const updateSatelliteResource = (payload: SatelliteResourceUpsertPayload & { id: string }) => {
  return requestAPI.put<AxiosResponseType<unknown>>(BASE, payload)
}

/**
 * 删除卫星。
 *
 * @param id 记录 id
 */
export const deleteSatelliteResource = (id: string) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`${BASE}/${id}`)
}

/**
 * Excel 批量导入卫星。
 *
 * @param file 导入文件
 */
export const importSatelliteResources = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return requestAPI.post<AxiosResponseType<SatelliteImportResult>>(`${BASE}/import`, formData, {
    'Content-Type': 'multipart/form-data',
  })
}

/**
 * 按系列名称检索卫星（任务装配预览等）。
 *
 * @param series 系列名称
 */
export const getSatelliteResourcesBySeries = (series: string) => {
  return searchSatelliteResources({ series })
}

/**
 * 任务装配 / C2：按多国汇总系列。
 * 系列名来自 `GET /resource/satellite/series`；侦察/通信分组来自同国 `search` 结果并与系列名取交集。
 *
 * @param countryList 国家列表
 */
export const loadSatelliteSeriesDataForCountries = async (
  countryList: string[],
): Promise<SatelliteSeriesData> => {
  const merged: SatelliteSeriesData = { 侦察: [], 通信: [] }
  const countries = countryList.map((c) => c.trim()).filter(Boolean)
  if (!countries.length) {
    return merged
  }

  await Promise.all(
    countries.map(async (country) => {
      const [seriesNames, searchRes] = await Promise.all([
        fetchSatelliteSeriesNamesByCountry(country),
        searchSatelliteResources({ country }),
      ])
      const allowed = new Set(seriesNames)
      if (!isResourceApiSuccess(searchRes.code)) {
        throw new Error(searchRes.msg || `检索卫星资源失败：country=${country}`)
      }
      const grouped = buildSatelliteSeriesDataFromSearchResults(searchRes.data ?? [])
      const pick = (names: string[]) => names.filter((series) => allowed.has(series))
      merged.侦察.push(...pick(grouped.侦察))
      merged.通信.push(...pick(grouped.通信))
    }),
  )

  merged.侦察 = [...new Set(merged.侦察.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  merged.通信 = [...new Set(merged.通信.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return merged
}