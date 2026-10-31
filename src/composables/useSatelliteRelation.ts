/**
 * 卫星关系数据管理
 * 负责加载卫星间的关系数据（共轨、共面、抵近等）并计算关系项列表
 */
import { ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import { getSatelliteRelations, getSatelliteRelationsBySatellite } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'

import type { SatelliteRelation } from '@/types/dashboard'
import type { BlueSatelliteRecord, SatelliteRelationItem } from '@/types/strike'

/**
 * 加载并整理卫星关系（共轨、共面、相位稳定、抵近），供关系视图连线与列表使用。
 *
 * @param blueSatellites 当前场景蓝方卫星列表
 * @param viewer 主 Cesium Viewer，用于取时钟时刻计算实时距离
 * @param getSatellitePositionAtTime 按时刻传播卫星世界坐标
 * @returns 关系边、加载方法以及选中卫星的关系项列表
 */
export function useSatelliteRelation(
  blueSatellites: { value: BlueSatelliteRecord[] },
  viewer: ShallowRef<Cesium.Viewer | null>,
  getSatellitePositionAtTime: (satellite: BlueSatelliteRecord, currentTime?: Cesium.JulianDate) => Cesium.Cartesian3
) {
  /** 布局 Store，读取当前激活任务 ID */
  const store = useLayoutStore()

  /** 已加载的卫星关系边（source / target / 关系类型 / 最小距离） */
  const satelliteRelationEdges = ref<SatelliteRelation[]>([])
  /** 当前关系数据所属任务 ID；用于跳过重复请求 */
  const satelliteRelationTaskId = ref<number | null>(null)
  /** 按单星加载时的源 NORAD；全量加载时为 null */
  const satelliteRelationSourceNorad = ref<number | null>(null)

  // ─── 关系标签与优先级 ───

  /**
   * 将接口关系文案归一为展示标签。
   * 匹配顺序为抵近、共面、相位稳定、共轨；无法识别时保留原文，空值回落为「关系」。
   *
   * @param relation 接口原始关系描述
   * @returns 归一化后的关系标签
   */
  const normalizeRelationLabel = (relation?: string): string => {
    /** 接口原文，空值视为空串 */
    const text = String(relation ?? '')
    if (text.includes('抵近')) return '抵近'
    if (text.includes('共面')) return '共面'
    if (text.includes('相位稳定')) return '相位稳定'
    if (text.includes('共轨')) return '共轨'
    return text || '关系'
  }

  /**
   * 关系展示优先级，数值越小越靠前。
   * 共轨 0、共面 1、相位稳定 2、抵近 3，其余为 4。
   *
   * @param relation 接口原始关系描述
   * @returns 排序优先级
   */
  const getRelationPriority = (relation?: string): number => {
    /** 归一化后的关系标签，用于 switch 匹配 */
    const label = normalizeRelationLabel(relation)
    switch (label) {
      case '共轨':
        return 0
      case '共面':
        return 1
      case '相位稳定':
        return 2
      case '抵近':
        return 3
      default:
        return 4
    }
  }

  /**
   * 按关系标签返回连线与列表使用的颜色。
   *
   * @param label 已归一化的关系标签
   * @returns CSS 颜色字符串
   */
  const getRelationColor = (label: string): string => {
    switch (label) {
      case '共轨':
        return '#58c9d1'
      case '共面':
        return '#7cd992'
      case '相位稳定':
        return '#8cc6ff'
      case '抵近':
        return '#f0b35b'
      default:
        return '#f4fbff'
    }
  }

  // ─── 数据加载 ───

  /**
   * 加载卫星关系数据
   * 如果提供了 NORAD ID 则加载与该卫星相关的关系，否则加载当前任务的所有关系
   */
  const loadSatelliteRelationData = async (norad?: number) => {
    /** 当前激活任务；无任务时清空关系缓存 */
    const taskId = store.activeTask?.id
    if (!taskId) {
      satelliteRelationEdges.value = []
      satelliteRelationTaskId.value = null
      satelliteRelationSourceNorad.value = null
      return
    }

    /** 指定 NORAD 时按单星查询，否则加载任务全量关系 */
    const targetNorad = Number.isFinite(norad ?? NaN) ? Number(norad) : null
    if (
      satelliteRelationTaskId.value === taskId &&
      satelliteRelationSourceNorad.value === targetNorad &&
      satelliteRelationEdges.value.length > 0
    ) {
      return
    }

    /** 单星或全量关系接口响应 */
    const res = targetNorad
      ? await getSatelliteRelationsBySatellite(targetNorad, taskId)
      : await getSatelliteRelations(taskId)

    if (res.code === 200 && res.data) {
      satelliteRelationEdges.value = res.data.relationships ?? []
      satelliteRelationTaskId.value = taskId
      satelliteRelationSourceNorad.value = targetNorad
    }
  }

  /**
   * 计算与选中卫星相关的卫星关系项列表
   * 包含每个相关卫星的信息、关系标签、距离、颜色和优先级
   */
  const getSelectedSatelliteRelations = (
    selectedSatelliteRecord: BlueSatelliteRecord | null
  ): SatelliteRelationItem[] => {
    /** 当前选中卫星；未选中时关系列表为空 */
    const selected = selectedSatelliteRecord
    if (!selected) return []

    /** 选中卫星 NORAD，用于匹配关系边的 source / target */
    const selectedNorad = Number(selected.noradId)
    /** 选中卫星在当前时钟下的世界坐标，用于补算实时距离 */
    const selectedPosition = getSatellitePositionAtTime(selected, viewer.value?.clock.currentTime)
    /** 对端 NORAD → 优先级最高（距离更近时再打破平局）的一条关系 */
    const relationByOtherNorad = new Map<string, SatelliteRelation>()

    for (const relation of satelliteRelationEdges.value) {
      /** 与选中星相连的另一端 NORAD；边不包含选中星时为 null */
      const otherNorad =
        relation.source === selectedNorad ? relation.target : relation.target === selectedNorad ? relation.source : null
      if (!otherNorad) continue

      /** 同一对端已保留的关系，用于按优先级去重 */
      const existing = relationByOtherNorad.get(String(otherNorad))
      if (!existing) {
        relationByOtherNorad.set(String(otherNorad), relation)
        continue
      }

      /** 已保留关系与候选关系的优先级，数值更小者胜出 */
      const existingPriority = getRelationPriority(existing.relation)
      const nextPriority = getRelationPriority(relation.relation)
      if (
        nextPriority < existingPriority ||
        (nextPriority === existingPriority && relation.min_distance_km < existing.min_distance_km)
      ) {
        relationByOtherNorad.set(String(otherNorad), relation)
      }
    }

    return blueSatellites.value
      .filter((satellite) => satellite.noradId !== selected.noradId)
      .map((satellite) => {
        /** 该卫星相对选中星的最优关系；无关系则不进入列表 */
        const relation = relationByOtherNorad.get(satellite.noradId)
        if (!relation) return null

        /** 对端卫星当前世界坐标 */
        const satellitePosition = getSatellitePositionAtTime(satellite, viewer.value?.clock.currentTime)
        /** 优先使用接口最小距离，缺失时用当前坐标实时计算（千米） */
        const distanceKm =
          relation.min_distance_km || Cesium.Cartesian3.distance(selectedPosition, satellitePosition) / 1000
        /** 展示用关系标签 */
        const label = normalizeRelationLabel(relation.relation)
        return {
          satellite,
          label,
          distanceKm,
          color: getRelationColor(label),
          priority: getRelationPriority(relation.relation),
          relation,
        }
      })
      .filter((item): item is SatelliteRelationItem => Boolean(item))
      .sort((left, right) => left.priority - right.priority || left.distanceKm - right.distanceKm)
  }

  return {
    satelliteRelationEdges,
    satelliteRelationTaskId,
    satelliteRelationSourceNorad,
    normalizeRelationLabel,
    getRelationPriority,
    getRelationColor,
    loadSatelliteRelationData,
    getSelectedSatelliteRelations,
  }
}
