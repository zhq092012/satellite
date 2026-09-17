import type { SatelliteThreatInfo } from '@/api/electronic'

/** 威胁度算法参数展示行 */
export interface SatelliteThreatInfoFieldRow {
  /** 字段中文标签 */
  label: string
  /** 展示值（空值已格式化为 `--`） */
  value: string
}

/**
 * 将接口字段格式化为弹窗展示文本。
 *
 * @param value 原始值
 * @returns 展示文本；无有效值时返回 `--`
 */
export const formatThreatInfoDisplayValue = (value: unknown): string => {
  if (value == null) return '--'
  if (typeof value === 'string' && !value.trim()) return '--'
  if (typeof value === 'number' && !Number.isFinite(value)) return '--'
  return String(value)
}

/**
 * 将 {@link SatelliteThreatInfo} 转为弹窗字段列表。
 *
 * @param info 接口返回的威胁度算法参数
 * @returns 按展示顺序排列的字段行
 */
export const buildSatelliteThreatInfoFieldRows = (
  info: SatelliteThreatInfo | null | undefined
): SatelliteThreatInfoFieldRow[] => {
  const base = info?.satelliteBaseModelResp

  return [
    { label: 'NORAD', value: formatThreatInfoDisplayValue(base?.norad) },
    { label: '英文名称', value: formatThreatInfoDisplayValue(base?.name_en) },
    { label: '载荷类型', value: formatThreatInfoDisplayValue(base?.sat_type) },
    { label: '在轨状态', value: formatThreatInfoDisplayValue(base?.orbitStatusIndicator) },
    { label: '国别', value: formatThreatInfoDisplayValue(base?.countryIndicator) },
    { label: '用户属性', value: formatThreatInfoDisplayValue(base?.usageIndicator) },
    { label: '剩余工作寿命', value: formatThreatInfoDisplayValue(base?.remainLifetimeIndicator) },
    { label: '通信带宽指标', value: formatThreatInfoDisplayValue(info?.txBandwidth) },
    { label: '同时服务用户数指标', value: formatThreatInfoDisplayValue(info?.txUserNum) },
    { label: '高轨通信卫星定点位置', value: formatThreatInfoDisplayValue(info?.txFixedPosition) },
    { label: '通信覆盖重数指标', value: formatThreatInfoDisplayValue(info?.txCoverage) },
    { label: '通信重访周期', value: formatThreatInfoDisplayValue(info?.txCycle) },
    { label: '成像分辨率', value: formatThreatInfoDisplayValue(info?.zhchResolution) },
    { label: '成像幅宽', value: formatThreatInfoDisplayValue(info?.zhchSwathWidth) },
    { label: '高轨卫星定点位置', value: formatThreatInfoDisplayValue(info?.zhchFixedPosition) },
    { label: '降交点地方时', value: formatThreatInfoDisplayValue(info?.zhchLtdn) },
    { label: '重访周期', value: formatThreatInfoDisplayValue(info?.zhchCycle) },
    { label: '威胁度', value: formatThreatInfoDisplayValue(info?.threatScore) },
    { label: '威胁度计算公式', value: formatThreatInfoDisplayValue(info?.formula) },
  ]
}
