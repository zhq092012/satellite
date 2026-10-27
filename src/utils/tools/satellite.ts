/**
 * 轨道类型、在轨状态、载荷状态在数字编码与中文文案之间的双向转换。
 * 编码约定：未知 0、低轨/在轨/堪用 1，其余按业务枚举递增；无法识别时返回 -1 或「未知」。
 */

/**
 * 将轨道类型中文名转为数字编码。
 *
 * @param type 轨道类型文案，如「低轨」「中轨」「高轨」「大椭圆」
 * @returns 对应编码；无法识别时为 -1
 */
export function getOrbitNumType(type: string) {
  switch (type) {
    case '未知':
      return 0
    case '低轨':
      return 1
    case '中轨':
      return 2
    case '高轨':
      return 3
    case '大椭圆':
      return 4
    default:
      return -1
  }
}

/**
 * 将卫星在轨状态中文名转为数字编码。
 *
 * @param status 在轨状态文案：「未知」「在轨」「离轨」
 * @returns 对应编码；无法识别时为 -1
 */
export function getOrbitNumStatus(status: string) {
  switch (status) {
    case '未知':
      return 0
    case '在轨':
      return 1
    case '离轨':
      return 2
    default:
      return -1
  }
}

/**
 * 将载荷可用状态中文名转为数字编码。
 *
 * @param status 载荷状态文案：「未知」「堪用」「失效」
 * @returns 对应编码；无法识别时为 -1
 */
export function getPayloadNumStatus(status: string) {
  switch (status) {
    case '未知':
      return 0
    case '堪用':
      return 1
    case '失效':
      return 2
    default:
      return -1
  }
}

/** 轨道类型编码 → 中文 */
const orbitTypeMap = new Map<number, string>([
  [0, '未知'],
  [1, '低轨'],
  [2, '中轨'],
  [3, '高轨'],
  [4, '大椭圆'],
])
/** 在轨状态编码 → 中文 */
const orbitStatusMap = new Map<number, string>([
  [0, '未知'],
  [1, '在轨'],
  [2, '离轨'],
])
/** 载荷状态编码 → 中文 */
const payloadStatusMap = new Map<number, string>([
  [0, '未知'],
  [1, '堪用'],
  [2, '失效'],
])

/**
 * 将轨道类型编码还原为中文。
 *
 * @param type 轨道类型编码，见 {@link getOrbitNumType}
 * @returns 中文类型；编码不在表内时为「未知」
 */
export function getOrbitType(type: number): string {
  return orbitTypeMap.get(type) || '未知'
}

/**
 * 将在轨状态编码还原为中文。
 *
 * @param status 在轨状态编码，见 {@link getOrbitNumStatus}
 * @returns 中文状态；编码不在表内时为「未知」
 */
export function getOrbitStatus(status: number): string {
  return orbitStatusMap.get(status) || '未知'
}

/**
 * 将载荷状态编码还原为中文。
 *
 * @param status 载荷状态编码，见 {@link getPayloadNumStatus}
 * @returns 中文状态；编码不在表内时为「未知」
 */
export function getPayloadStatus(status: number): string {
  return payloadStatusMap.get(status) || '未知'
}
