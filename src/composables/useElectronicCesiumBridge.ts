import { computed, type Ref } from 'vue'
import * as Cesium from 'cesium'
import type {
  MatrixResult,
  ReceiveObj,
  StationObj
} from '@/api/electronic'

/**
 * [类型用途]
 * 地面站/中心云站解析后的经纬度坐标对象。
 */
export interface InfrastructureLocation {
  /** 节点唯一标识 ID */
  id: string
  /** 节点显示名称 */
  name: string
  /** 节点类别: RECEIVE - 地面接收站, STATION - 中心云站 */
  type: 'RECEIVE' | 'STATION'
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 海拔高度 (单位: 米) */
  altitude: number
  /** 打击毁伤状态: 0 - 正常可用, 1 - 被打击/毁伤 */
  status: number
}

/**
 * [类型用途]
 * 单条 3D 链路在特定时刻的状态与材质信息。
 */
export interface LinkVisualState {
  /** 链路唯一 Key (例如 "sat-50001-rec-REC_01") */
  key: string
  /** 源节点名称/ID */
  fromName: string
  /** 目标节点名称/ID */
  toName: string
  /** 链路起点 Cartesian3 坐标 */
  fromPosition: Cesium.Cartesian3
  /** 链路终点 Cartesian3 坐标 */
  toPosition: Cesium.Cartesian3
  /** 链路分类: RELAY - 星中中继, TRANSIT - 星地过境, GROUND - 地地传输 */
  category: 'RELAY' | 'TRANSIT' | 'GROUND'
  /** 链路状态: 0 - 正常流动, 1 - 被打压/干扰, 2 - 摧毁中断 */
  status: number
}

/**
 * [功能]
 * 桥接 Electronic 模块算法矩阵结果 MatrixResult 至 Cesium 3D 渲染所需的数据格式。
 *
 * [处理规则]
 * - 转换经纬度字符串为标准 Cartographic / Cartesian3
 * - 计算当前时间点落入过境窗口 (peakWindow ~ endWindow) 的星地连线
 * - 解析星中中继 (relayRelation) 与地地传输网 (stationRelationList)
 *
 * [修改约束]
 * - 优先复用现有 types 定义
 * - 保证注释完整，不出错
 *
 * @param matrixData 响应式的 MatrixResult 算法矩阵数据（允许 null 或 undefined）
 * @returns 格式化后的基础设施点位与链路状态钩子
 */
export function useElectronicCesiumBridge(matrixData: Ref<MatrixResult | null | undefined>) {
  /**
   * 解析经纬度字符串 (例如 "68.350,133.500") 为数值
   *
   * @param latLonStr 经纬度字符串
   * @returns [latitude, longitude] 或默认 [0, 0]
   */
  const parseLatLon = (latLonStr: string): [number, number] => {
    if (!latLonStr) return [0, 0]
    const parts = latLonStr.split(',').map((val) => parseFloat(val.trim()))
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]]
    }
    return [0, 0]
  }

  /**
   * 解析出来的所有地面基础设施 (接收站 + 中心云站)
   */
  const infrastructureNodes = computed<InfrastructureLocation[]>(() => {
    if (!matrixData.value) return []

    const nodes: InfrastructureLocation[] = []
    const relationData =
      matrixData.value.initRelationList?.receiveObjList?.length || matrixData.value.initRelationList?.stationObjList?.length
        ? matrixData.value.initRelationList
        : matrixData.value.stationRelationList

    if (relationData?.receiveObjList) {
      relationData.receiveObjList.forEach((rec: ReceiveObj) => {
        const [lat, lon] = parseLatLon(rec.receiveLatLon)
        nodes.push({
          id: rec.receiveId,
          name: rec.receiveName,
          type: 'RECEIVE',
          latitude: lat,
          longitude: lon,
          altitude: 100, // 地面高度 100 米
          status: rec.receiveStatus ?? 0,
        })
      })
    }

    if (relationData?.stationObjList) {
      relationData.stationObjList.forEach((st: StationObj) => {
        const [lat, lon] = parseLatLon(st.stationLatLon)
        nodes.push({
          id: st.stationId,
          name: st.stationName,
          type: 'STATION',
          latitude: lat,
          longitude: lon,
          altitude: 100,
          status: st.stationStatus ?? 0,
        })
      })
    }

    return nodes
  })

  /**
   * 解析中继卫星 NORAD 列表集合
   */
  const relayNoradSet = computed<Set<number>>(() => {
    const set = new Set<number>()
    if (matrixData.value?.relayRelation?.relayList) {
      matrixData.value.relayRelation.relayList.forEach((norad) => set.add(norad))
    }
    return set
  })

  /**
   * 检查指定时间 (ISO 字符串或 Date) 是否落在时间窗口内
   *
   * @param currentTime 当前推演时刻 Date
   * @param windowStart 开始窗口 ISO 字符串
   * @param windowEnd 结束窗口 ISO 字符串
   */
  const isTimeInWindow = (currentTime: Date, windowStart: string, windowEnd: string): boolean => {
    if (!windowStart || !windowEnd) return false
    const start = new Date(windowStart).getTime()
    const end = new Date(windowEnd).getTime()
    const cur = currentTime.getTime()
    return cur >= start && cur <= end
  }

  return {
    infrastructureNodes,
    relayNoradSet,
    isTimeInWindow,
  }
}
