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
const orbitTypeMap = new Map<number, string>([
  [0, '未知'],
  [1, '低轨'],
  [2, '中轨'],
  [3, '高轨'],
  [4, '大椭圆'],
])
const orbitStatusMap = new Map<number, string>([
  [0, '未知'],
  [1, '在轨'],
  [2, '离轨'],
])
const payloadStatusMap = new Map<number, string>([
  [0, '未知'],
  [1, '堪用'],
  [2, '失效'],
])
export function getOrbitType(type: number): string {
  return orbitTypeMap.get(type) || '未知'
}
export function getOrbitStatus(status: number): string {
  return orbitStatusMap.get(status) || '未知'
}
export function getPayloadStatus(status: number): string {
  return payloadStatusMap.get(status) || '未知'
}
