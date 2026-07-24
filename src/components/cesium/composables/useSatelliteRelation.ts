/**
 * 卫星关系数据管理
 * 负责加载卫星间的关系数据（共轨、共面、抵近等）并计算关系项列表
 */
import { ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import { getSatelliteRelations, getSatelliteRelationsBySatellite } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import type { BlueSatelliteRecord, SatelliteRelationItem } from '../types'

export function useSatelliteRelation(
  blueSatellites: { value: BlueSatelliteRecord[] },
  viewer: ShallowRef<Cesium.Viewer | null>,
  getSatellitePositionAtTime: (satellite: BlueSatelliteRecord, currentTime?: Cesium.JulianDate) => Cesium.Cartesian3
) {
  const store = useLayoutStore()

  const satelliteRelationEdges = ref<SatelliteRelation[]>([])
  const satelliteRelationTaskId = ref<number | null>(null)
  const satelliteRelationSourceNorad = ref<number | null>(null)

  // ─── 关系标签与优先级 ───

  const normalizeRelationLabel = (relation?: string): string => {
    const text = String(relation ?? '')
    if (text.includes('抵近')) return '抵近'
    if (text.includes('共面')) return '共面'
    if (text.includes('相位稳定')) return '相位稳定'
    if (text.includes('共轨')) return '共轨'
    return text || '关系'
  }

  const getRelationPriority = (relation?: string): number => {
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
    const taskId = store.activedTask?.id
    if (!taskId) {
      satelliteRelationEdges.value = []
      satelliteRelationTaskId.value = null
      satelliteRelationSourceNorad.value = null
      return
    }

    const targetNorad = Number.isFinite(norad ?? NaN) ? Number(norad) : null
    if (
      satelliteRelationTaskId.value === taskId &&
      satelliteRelationSourceNorad.value === targetNorad &&
      satelliteRelationEdges.value.length > 0
    ) {
      return
    }

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
    const selected = selectedSatelliteRecord
    if (!selected) return []

    const selectedNorad = Number(selected.noradId)
    const selectedPosition = getSatellitePositionAtTime(selected, viewer.value?.clock.currentTime)
    const relationByOtherNorad = new Map<string, SatelliteRelation>()

    for (const relation of satelliteRelationEdges.value) {
      const otherNorad =
        relation.source === selectedNorad ? relation.target : relation.target === selectedNorad ? relation.source : null
      if (!otherNorad) continue

      const existing = relationByOtherNorad.get(String(otherNorad))
      if (!existing) {
        relationByOtherNorad.set(String(otherNorad), relation)
        continue
      }

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
        const relation = relationByOtherNorad.get(satellite.noradId)
        if (!relation) return null

        const satellitePosition = getSatellitePositionAtTime(satellite, viewer.value?.clock.currentTime)
        const distanceKm =
          relation.min_distance_km || Cesium.Cartesian3.distance(selectedPosition, satellitePosition) / 1000
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
