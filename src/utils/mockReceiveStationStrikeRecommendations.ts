import { buildGroundTargetKey } from '@/utils/buildBattleGlobeGroundTargets'
import { sortStrikeRecommendByCompositeThreat } from '@/utils/mockSatelliteStrikeRecommendations'

/**
 * 接收站打击推荐列表行（接口未就绪前的占位结构，与后端建议字段对齐）。
 */
export interface ReceiveStationStrikeRecommendItem {
  /** 接收站业务 ID（与任务资源 / 矩阵 station 一致） */
  stationId: string
  /** 地图与右侧面板选中键（receive:{stationId}） */
  targetKey: string
  /** 接收站名称（展示用） */
  name: string
  /** 综合威胁度（排序主键，降序） */
  compositeThreat: number
  /** 静态威胁度 */
  staticThreat: number
  /** 动态威胁度 */
  dynamicThreat: number
}

/**
 * 构建接收站推荐 mock 行（统一 targetKey 规则）。
 *
 * @param stationId 接收站 ID
 * @param name 名称
 * @param compositeThreat 综合威胁度
 * @param staticThreat 静态威胁度
 * @param dynamicThreat 动态威胁度
 * @returns 推荐行
 */
const mockReceiveRow = (
  stationId: string,
  name: string,
  compositeThreat: number,
  staticThreat: number,
  dynamicThreat: number
): ReceiveStationStrikeRecommendItem => ({
  stationId,
  targetKey: buildGroundTargetKey('receive', stationId),
  name,
  compositeThreat,
  staticThreat,
  dynamicThreat,
})

/**
 * 占位假数据：按综合威胁度降序预排序。
 * 接入接口后删除或改为仅在无 API 数据时使用。
 */
export const MOCK_RECEIVE_STATION_STRIKE_RECOMMENDATIONS: ReceiveStationStrikeRecommendItem[] =
  sortStrikeRecommendByCompositeThreat([
    mockReceiveRow('rcv-1001', '威尔克斯巴里站', 0.896, 0.812, 0.941),
    mockReceiveRow('rcv-1002', '锡拉丘兹地面站', 0.871, 0.798, 0.903),
    mockReceiveRow('rcv-1003', '费尔班克斯接收站', 0.839, 0.776, 0.884),
    mockReceiveRow('rcv-1004', '霍巴特地面站', 0.802, 0.741, 0.851),
    mockReceiveRow('rcv-1005', '特内里费接收站', 0.768, 0.702, 0.819),
    mockReceiveRow('rcv-1006', '新加坡地面站', 0.734, 0.688, 0.776),
  ])
