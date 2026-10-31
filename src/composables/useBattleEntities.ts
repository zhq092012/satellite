import { readThemeColor } from '@/styles/themeColor'
/**
 * 战场实体渲染
 * 根据当前图层模式在 Cesium 中绘制蓝方卫星、红方武器、打击链路与关系连线，
 * 并同步打击阶段样式（闪烁、淡出、特效图标）及相机跟随逻辑
 */
import { type Ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import type { StrikePlanV2MissionWindowItem } from '@/api/strike-plan/satellite-strike-plan-api'
import { buildSatelliteInfoBoxDescription } from '@/utils/tools/cesiumInfoBox'
import {
  createSatelliteStrikeStarDataUri,
  createStationExplosionDiamondDataUri,
  createWeaponIconDataUri,
  getWeaponIconScale,
} from '@/utils/tools/cesiumEntityIcon'
import {
  getStrikePhase,
  getStrikeTypeStyle,
  mixColor,
  STRIKE_LINK_FADE_MS,
  STRIKE_SATELLITE_BLINK_MS,
} from '@/utils/tools/cesiumStrikeStyle'
import { parseMissionWindowDate } from '@/utils/tools/dateFormat'
import type { Weapon } from '@/types/dashboard'
import type { BlueSatelliteRecord, SatelliteRelationItem } from '@/types/strike'
import type { SatelliteDetail } from '@/types/cesium/satellite'

/**
 * tips:由于在这个业务场景中，地面站被统一适配并存放在了 blueSatellites 集合中（将它的 satType 设为 '基站'，高度 altitude 设为 100 ），
 * 所以连线逻辑在处理卫星和处理地面站时复用了同一个循环，只是通过特定的判断来区分了它们的显示样式。
 */


/**
 * 按当前图层在 Cesium 中绘制卫星、武器、打击链路与关系连线。
 *
 * @param viewer Cesium 视图实例
 * @param activeLayerOption 当前图层（对比视图 / 关系卫星 / 杀伤链等）
 * @param selectedPlanMissionWindows 当前方案的任务窗口列表
 * @param selectedSatelliteRecord 关系视图中选中的卫星
 * @param blueSatellites 蓝方卫星（地面站也适配进该集合）
 * @param redWeapons 红方武器
 * @param completedStrikeWindowIds 已完成打击的窗口 ID 集合
 * @param selectedSatelliteNoradId 当前选中卫星 NORAD
 * @param selectedSatelliteDetail 选中卫星档案，用于信息框与轨道
 * @param dependencies 位置计算、轨道构建、场景跳转与窗口运行时状态
 * @returns 战场实体渲染与显隐方法
 */
export function useBattleEntities(
  viewer: ShallowRef<Cesium.Viewer | null>,
  activeLayerOption: Ref<string>,
  selectedPlanMissionWindows: Ref<StrikePlanV2MissionWindowItem[]>,
  selectedSatelliteRecord: Ref<BlueSatelliteRecord | null>,
  blueSatellites: Ref<BlueSatelliteRecord[]>,
  redWeapons: Ref<Weapon[]>,
  completedStrikeWindowIds: Ref<Set<string>>,
  selectedSatelliteNoradId: Ref<string>,
  selectedSatelliteDetail: Ref<SatelliteDetail | null>,
  dependencies: {
    /** 选中卫星的关系项列表 */
    getSelectedSatelliteRelations: () => SatelliteRelationItem[]
    /** 按时钟传播卫星世界坐标 */
    getSatellitePositionAtTime: (satellite: BlueSatelliteRecord, currentTime?: Cesium.JulianDate) => Cesium.Cartesian3
    /** 构建选中卫星一圈轨道折线 */
    buildSatelliteOrbitPositions: (
      satellite: BlueSatelliteRecord,
      currentTime: Cesium.JulianDate,
      detail?: SatelliteDetail | null
    ) => Cesium.Cartesian3[]
    /** 相机飞到场景总览 */
    flyToScene: () => void
    /** 判断任务窗口相对当前时刻是进行中还是已完成 */
    getMissionRuntimeState: (
      mission: StrikePlanV2MissionWindowItem,
      currentDate: Date
    ) => { active: boolean; completed: boolean }
  }
) {
  // 上一轮渲染仍存在的实体 ID，用于增量隐藏过期实体
  let renderedBattleEntityIds = new Set<string>()
  // 上次相机跟随的打击任务键，避免同一任务重复 flyTo
  let lastStrikeFollowKey: string | null = null

  // ─── 实体工具函数 ───

  /**
   * 按 ID 复用已有实体，不存在则创建并设为可见。
   *
   * @param id 实体 ID
   * @param createOptions 首次创建时的实体配置
   * @returns 实体；Viewer 未就绪时为 null
   */
  const getOrCreateBattleEntity = (id: string, createOptions: Record<string, unknown>) => {
    if (!viewer.value) return null

    /** 同 ID 已存在的实体，复用以避免每帧重建 */
    const existing = viewer.value.entities.getById(id)
    if (existing) {
      existing.show = true
      return existing
    }

    return viewer.value.entities.add(createOptions)
  }

  /**
   * 隐藏本轮未再使用的实体，保留集合供下次 diff(添加一个打击后的效果实体，移除之前打击任务的实体)
   * @param nextEntityIds 下一轮需要展示的实体 ID 集合
   * 
   */
  const hideStaleBattleEntities = (nextEntityIds: Set<string>) => {
    if (!viewer.value) return

    for (const entityId of renderedBattleEntityIds) {
      if (nextEntityIds.has(entityId)) continue
      /** 本轮不再使用的实体，隐藏而不是删除，供下轮复用 */
      const entity = viewer.value.entities.getById(entityId)
      if (entity) {
        entity.show = false
      }
    }

    renderedBattleEntityIds = nextEntityIds
  }

  /**
   * 判断目标点是否位于相机朝向的可见半球（用于隐藏背对地球的武器覆盖圈）。
   *
   * @param position 目标世界坐标
   * @returns 相机与目标方向夹角为锐角时可见
   */
  const isVisibleFromCamera = (position: Cesium.Cartesian3) => {
    if (!viewer.value) return true

    /** 相机位置与目标位置相对地心的单位方向 */
    const cameraDirection = Cesium.Cartesian3.normalize(viewer.value.camera.positionWC, new Cesium.Cartesian3())
    const targetDirection = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3())
    return Cesium.Cartesian3.dot(cameraDirection, targetDirection) >= 0
  }

  // ─── 主渲染逻辑 ───

  /** 时钟 tick 上的相机跟随监听，卸载或重绑前需移除 */
  let clockFollowListener: Cesium.Event.RemoveCallback | null = null

  /**
   * 渲染战场全部 Cesium 实体
   * @param skipFlyTo 为 true 时跳过全局场景 flyTo（时钟 tick 等高频刷新场景）
   * @param resetEntities 为 true 时先清空实体集合再重建
   */
  const renderBattleEntities = (skipFlyTo = false, resetEntities = false) => {
    if (!viewer.value) return

    // 杀伤链图层由独立模块渲染，此处清空后退出
    if (activeLayerOption.value === '杀伤链') {
      viewer.value.entities.removeAll()
      renderedBattleEntityIds = new Set<string>()
      return
    }

    /** 当前 Viewer 的实体集合 */
    const entityCollection = viewer.value.entities
    if (resetEntities) {
      entityCollection.removeAll()
      renderedBattleEntityIds = new Set<string>()
    }

    /** 当前方案窗口与图层模式 */
    const missionWindows = selectedPlanMissionWindows.value
    const layerMode = activeLayerOption.value
    /** 对比视图隐藏已完成目标；关系视图只画选中星及其关联星 */
    const compareMode = layerMode === '对比视图'
    const relationMode = layerMode === '关系卫星'
    const selectedSatellite = relationMode ? selectedSatelliteRecord.value : null

    // ─── 任务窗口索引 ───

    /** 关系视图：对端 NORAD → 关系项；其他图层为 null */
    const relationItems =
      relationMode && selectedSatellite
        ? new Map(dependencies.getSelectedSatelliteRelations().map((item) => [item.satellite.noradId, item]))
        : null

    /** 卫星 NORAD、武器 ID → 关联任务窗口，以及武器 ID → 类型 */
    const missionWindowsBySatellite = new Map<string, StrikePlanV2MissionWindowItem[]>()
    const missionWindowsByWeapon = new Map<string, StrikePlanV2MissionWindowItem[]>()
    const weaponTypeById = new Map<string, string>()
    /**
     * 创建一个 set，用于存储本次渲染的实体 ID
     * 这样可以在下一次渲染时，将本次未使用的实体从 viewer 中移除
     */
    const nextEntityIds = new Set<string>()

    redWeapons.value.forEach((weapon, index) => {
      weaponTypeById.set(String(weapon.id ?? index), weapon.type)
    })

    for (const mission of missionWindows) {
      /** 窗口归属的卫星与武器键 */
      const satelliteKey = String(mission.satellite_id)
      const weaponKey = String(mission.weapon_id)

      if (!missionWindowsBySatellite.has(satelliteKey)) missionWindowsBySatellite.set(satelliteKey, [])
      missionWindowsBySatellite.get(satelliteKey)!.push(mission)

      if (!missionWindowsByWeapon.has(weaponKey)) missionWindowsByWeapon.set(weaponKey, [])
      missionWindowsByWeapon.get(weaponKey)!.push(mission)
    }

    /**
     * 在一组窗口中选取当前应展示的任务：优先进行中，其次已完成，否则取第一条。
     *
     * @param windows 同一卫星或武器的任务窗口
     * @param currentDate 当前时钟时刻
     * @returns 命中的窗口；列表为空时为 undefined
     */
    const getActiveMission = (windows: StrikePlanV2MissionWindowItem[], currentDate: Date) => {
      return (
        windows.find((mission) => dependencies.getMissionRuntimeState(mission, currentDate).active) ??
        windows.find((mission) => dependencies.getMissionRuntimeState(mission, currentDate).completed) ??
        windows[0]
      )
    }

    // ─── 蓝方卫星渲染 ───

    blueSatellites.value.forEach((satellite) => {
      /**
       * relationMode 是关系视图
       * relationItems 是关系视图的关联项
       * relationItems.has(satellite.noradId) 判断该卫星是否在关联项中
       * satellite.noradId !== selectedSatellite?.noradId 判断该卫星是否为选中的卫星
       * 以上两个条件有一个不满足，就不渲染该卫星
       * 
       */
      if (
        relationMode &&
        relationItems &&
        !relationItems.has(satellite.noradId) &&
        satellite.noradId !== selectedSatellite?.noradId
      ) {
        return
      }

      /** 打向该卫星的任务窗口 */
      const relatedWindows = missionWindowsBySatellite.get(satellite.noradId) ?? []
      /** 是否已有完成的打击，对比视图中不再绘制 */
      const isCompletedSatellite = relatedWindows.some((mission) =>
        completedStrikeWindowIds.value.has(`${mission.weapon_id}-${mission.satellite_id}`)
      )

      if (compareMode && isCompletedSatellite) return

      /** 卫星实体 ID，跨帧复用 */
      const satelliteEntityId = `satellite-${satellite.noradId}`
      nextEntityIds.add(satelliteEntityId)
      const satelliteEntity = getOrCreateBattleEntity(satelliteEntityId, {
        id: satelliteEntityId,
        name: satellite.name,
        point: new Cesium.PointGraphics(),
        label: new Cesium.LabelGraphics(),
        billboard: new Cesium.BillboardGraphics(),
      })

      if (satelliteEntity) {
        satelliteEntity.show = true
        satelliteEntity.name = satellite.name

        // Callback property for Position
        satelliteEntity.position = new Cesium.CallbackProperty(
          (time) => dependencies.getSatellitePositionAtTime(satellite, time),
          false
        ) as unknown as Cesium.PositionProperty

        /**
         * 计算该卫星在指定时刻的打击阶段、闪烁系数和样式。
         *
         * @param time Cesium 时钟时刻
         * @returns 阶段、闪烁、颜色样式及关联武器类型
         */
        const getSatState = (time: Cesium.JulianDate) => {
          /** 时钟对应的绝对时间 */
          const currentDate = Cesium.JulianDate.toDate(time)
          /** 当前应展示的打击窗口及其武器类型 */
          const relatedMission = getActiveMission(relatedWindows, currentDate)
          const relatedWeaponType = relatedMission ? (weaponTypeById.get(String(relatedMission.weapon_id)) ?? '') : ''
          /** 打击阶段：idle / active / fading / done */
          const phase = relatedMission ? getStrikePhase(relatedMission, currentDate) : 'idle'
          /** 打击中的闪烁系数，0–1 */
          const blink = phase === 'active' ? (Math.sin(currentDate.getTime() / STRIKE_SATELLITE_BLINK_MS) + 1) / 2 : 1
          /** 按武器类型与阶段混合出的颜色样式 */
          const style = getStrikeTypeStyle(relatedWeaponType, phase, blink)
          return { currentDate, relatedMission, phase, blink, style, relatedWeaponType }
        }

        /** 关系视图中该星的关系标签与颜色；非关系星为 undefined */
        const relationMeta = relationItems?.get(satellite.noradId)
        /** 未进入打击阶段时的默认卫星颜色 */
        const baseSatelliteColor = Cesium.Color.fromCssColorString(readThemeColor('--swatch-4ea6ff'))

        satelliteEntity.description = new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
          const { phase } = getSatState(time)
          return buildSatelliteInfoBoxDescription(
            satellite,
            satellite.noradId === selectedSatelliteNoradId.value ? selectedSatelliteDetail.value : null,
            phase
          )
        }, false)

        if (!satelliteEntity.point) satelliteEntity.point = new Cesium.PointGraphics()
        Object.assign(satelliteEntity.point, {
          show: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            const { phase } = getSatState(time)
            return phase !== 'fading' && phase !== 'done'
          }, false),
          pixelSize: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            if (relationMode && relationMeta) return 16
            const { phase } = getSatState(time)
            return phase === 'active' ? 15 : phase === 'fading' || phase === 'done' ? 14 : 10
          }, false),
          color: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            if (relationMode && relationMeta) return Cesium.Color.fromCssColorString(relationMeta.color).withAlpha(0.95)
            const { phase, blink, style } = getSatState(time)
            if (phase === 'active') return mixColor(baseSatelliteColor, style.satelliteColor, blink, 0.8 + 0.2 * blink)
            if (phase === 'fading' || phase === 'done') return style.satelliteColor
            return baseSatelliteColor
          }, false),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
        })

        if (!satelliteEntity.label) satelliteEntity.label = new Cesium.LabelGraphics()
        Object.assign(satelliteEntity.label, {
          text: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            const { phase } = getSatState(time)
            if (relationMode && relationMeta) return `${satellite.name}（${relationMeta.label}）`
            if (phase === 'active') return `${satellite.name}（打击中）`
            if (phase === 'fading' || phase === 'done') return `${satellite.name}（已打击）`
            return satellite.name
          }, false),
          font: '12px sans-serif',
          fillColor:
            relationMode && relationMeta ? Cesium.Color.fromCssColorString(relationMeta.color) : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          showBackground: true,
          backgroundColor:
            relationMode && relationMeta ? new Cesium.Color(0, 0, 0, 0.45) : new Cesium.Color(0, 0, 0, 0.35),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000000),
        })

        if (!satelliteEntity.billboard) satelliteEntity.billboard = new Cesium.BillboardGraphics()
        /** 打击完成图标缩放；关系星略大以便区分 */
        const starScale = relationMode && relationMeta ? 0.95 : 0.88
        // Pre-create images to avoid canvas generation in callback
        const staticStyle = getStrikeTypeStyle(
          relatedWindows[0] ? (weaponTypeById.get(String(relatedWindows[0].weapon_id)) ?? '') : '',
          'done',
          1
        )
        /** 完成后图标颜色：关系星用关系色，否则用打击完成色 */
        const staticColor =
          relationMode && relationMeta
            ? Cesium.Color.fromCssColorString(relationMeta.color).withAlpha(0.95)
            : staticStyle.satelliteColor
        /** 地面站用菱形爆炸标，卫星用星标，避免在回调里重复画布生成 */
        const lowMidImage = createStationExplosionDiamondDataUri(staticColor, starScale)
        const highImage = createSatelliteStrikeStarDataUri(staticColor, starScale)

        /** 地面站/雷达站或近地高度目标使用地面图标 */
        const isStation = satellite.satType === '基站' || satellite.satType === '雷达站' || satellite.altitude <= 100
        const staticImage = isStation ? lowMidImage : highImage
        /** 图标像素边长 */
        const staticSize = isStation ? 32 : 28

        Object.assign(satelliteEntity.billboard, {
          show: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            const { phase } = getSatState(time)
            return phase === 'fading' || phase === 'done'
          }, false),
          image: new Cesium.CallbackProperty(() => staticImage, false),
          scale: starScale,
          width: new Cesium.CallbackProperty(() => staticSize * starScale, false),
          height: new Cesium.CallbackProperty(() => staticSize * starScale, false),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          heightReference: Cesium.HeightReference.NONE,
        })

        // 选中卫星时叠加轨道高亮线 (STATIC)
        const selectedOrbitSatellite = selectedSatelliteRecord.value
        if (
          selectedSatelliteNoradId.value &&
          selectedOrbitSatellite &&
          satellite.noradId === selectedSatelliteNoradId.value
        ) {
          /** 选中卫星一圈轨道折线点 */
          const orbitPositions = dependencies.buildSatelliteOrbitPositions(
            selectedOrbitSatellite,
            viewer.value!.clock.currentTime,
            selectedSatelliteDetail.value
          )
          if (orbitPositions.length > 1) {
            /** 选中卫星轨道实体 ID */
            const orbitEntityId = `selected-satellite-orbit-${selectedOrbitSatellite.noradId}`
            nextEntityIds.add(orbitEntityId)
            const orbitEntity = getOrCreateBattleEntity(orbitEntityId, {
              id: orbitEntityId,
              polyline: new Cesium.PolylineGraphics(),
            })
            if (orbitEntity) {
              orbitEntity.show = true
              if (!orbitEntity.polyline) orbitEntity.polyline = new Cesium.PolylineGraphics()
              Object.assign(orbitEntity.polyline, {
                positions: orbitPositions,
                width: 3,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.2,
                  color: Cesium.Color.fromCssColorString(readThemeColor('--swatch-ffd166')).withAlpha(0.95),
                }),
                arcType: Cesium.ArcType.NONE,//使用直线连接
                clampToGround: false,
              })
            }
          }
        }

        // 关系视图：目标卫星独立高亮线
        if (relationMode && relationMeta) {
          /** 选中星实体 ID，避免给自己画关系线 */
          const selectedSatelliteEntityId = `satellite-${selectedSatellite?.noradId}`
          if (selectedSatellite && selectedSatelliteEntityId !== satelliteEntityId) {
            /** 选中星到当前关联星的连线实体 ID */
            const relationLinkId = `relation-link-${selectedSatellite.noradId}-${satellite.noradId}`
            nextEntityIds.add(relationLinkId)
            const relationLinkEntity = getOrCreateBattleEntity(relationLinkId, {
              id: relationLinkId,
              polyline: new Cesium.PolylineGraphics(),
            })
            if (relationLinkEntity) {
              relationLinkEntity.show = true
              if (!relationLinkEntity.polyline) relationLinkEntity.polyline = new Cesium.PolylineGraphics()
              Object.assign(relationLinkEntity.polyline, {
                positions: new Cesium.CallbackProperty(
                  (time = new Cesium.JulianDate()) => [
                    dependencies.getSatellitePositionAtTime(selectedSatellite, time),
                    dependencies.getSatellitePositionAtTime(satellite, time),
                  ],
                  false
                ),
                width: relationMeta.label === '抵近' ? 3 : 2,
                material: Cesium.Color.fromCssColorString(relationMeta.color).withAlpha(0.65),
                arcType: Cesium.ArcType.GEODESIC,//使用大圆弧连接
              })
            }
          }
        }
      }
    })

    // ─── 关系视图：目标卫星独立高亮 ───

    if (relationMode && selectedSatellite) {
      /** 关系视图目标星实体，单独放大并标成「目标卫星」 */
      const selectedSatelliteEntityId = `satellite-${selectedSatellite.noradId}`
      nextEntityIds.add(selectedSatelliteEntityId)
      const selectedSatelliteEntity = entityCollection.getById(selectedSatelliteEntityId)
      if (selectedSatelliteEntity) {
        selectedSatelliteEntity.show = true

        /**
         * 目标星在指定时刻的打击阶段。
         *
         * @param time Cesium 时钟时刻
         * @returns 打击阶段；没有对应窗口时为 idle
         */
        const getTargetState = (time: Cesium.JulianDate) => {
          /** 时钟对应的绝对时间 */
          const currentDate = Cesium.JulianDate.toDate(time)
          /** 打向目标星的任务窗口 */
          const mission = selectedPlanMissionWindows.value.find(
            (m) => String(m.satellite_id) === selectedSatellite.noradId
          )
          return mission ? getStrikePhase(mission, currentDate) : 'idle'
        }

        /** 目标星高亮色与完成后的星标 */
        const selectedSatelliteColor = Cesium.Color.fromCssColorString(readThemeColor('--swatch-f0b35b'))
        const targetImage = createSatelliteStrikeStarDataUri(selectedSatelliteColor, 0.92)

        if (!selectedSatelliteEntity.billboard) selectedSatelliteEntity.billboard = new Cesium.BillboardGraphics()
        Object.assign(selectedSatelliteEntity.billboard, {
          show: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            /** 仅在打击收尾或完成后显示星标 */
            const phase = getTargetState(time)
            return phase === 'fading' || phase === 'done'
          }, false),
          image: targetImage,
          scale: 0.92,
          width: 25.76,
          height: 25.76,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          heightReference: Cesium.HeightReference.NONE,
        })

        if (!selectedSatelliteEntity.point) selectedSatelliteEntity.point = new Cesium.PointGraphics()
        Object.assign(selectedSatelliteEntity.point, {
          show: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            /** 未完成时显示点，完成后改由星标接管 */
            const phase = getTargetState(time)
            return phase !== 'fading' && phase !== 'done'
          }, false),
          pixelSize: 18,
          color: selectedSatelliteColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.NONE,
        })

        if (!selectedSatelliteEntity.label) selectedSatelliteEntity.label = new Cesium.LabelGraphics()
        Object.assign(selectedSatelliteEntity.label, {
          text: `${selectedSatellite.name}（目标卫星）`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.fromCssColorString(readThemeColor('--swatch-f0b35b')),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.45),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000000),
        })
      }
    }

    // ─── 红方武器与打击链路 ───

    redWeapons.value.forEach((weapon, index) => {
      // 只有在非方案对比和非关联模式下才创建红方武器
      if (compareMode || relationMode) return

      /**
       * 获取武器关键信息
       */
      const weaponKey = String(weapon.id ?? index)//武器的key值
      const relatedWindows = missionWindowsByWeapon.get(weaponKey) ?? []//与武器关联的任务窗口
      const weaponStyle = getStrikeTypeStyle(weapon.type, 'idle')//武器的样式
      const position = Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 1500)//武器的位置
      const rangeMeters = Math.max(15000, Number(weapon.range ?? 0) * 1000)//武器的作用范围
      const weaponEntityId = `red-weapon-${weaponKey}`//武器的唯一ID
      nextEntityIds.add(weaponEntityId)//添加武器的ID

      /**
       * 汇总该武器全部窗口的运行状态：任一窗口进行中即为激活，任一窗口已结束即为完成。
       *
       * @param time Cesium 时钟时刻
       * @returns 是否执行中、是否已执行
       */
      const getWepState = (time: Cesium.JulianDate) => {
        /** 时钟对应的绝对时间 */
        const currentDate = Cesium.JulianDate.toDate(time)
        return relatedWindows.reduce(
          (state, mission) => {
            /** 单个窗口相对当前时刻的进行中 / 已完成 */
            const missionState = dependencies.getMissionRuntimeState(mission, currentDate)
            return {
              active: state.active || missionState.active,
              completed: state.completed || missionState.completed,
            }
          },
          { active: false, completed: false }
        )
      }
      /**
       * 获取武器实体
       */
      const weaponEntity = getOrCreateBattleEntity(weaponEntityId, {
        id: weaponEntityId,
        name: weapon.name,
        position,
        billboard: new Cesium.BillboardGraphics(),
        label: new Cesium.LabelGraphics(),
        ellipse: new Cesium.EllipseGraphics(),
      })

      /**
       * 更新武器实体属性
       */
      if (weaponEntity) {
        weaponEntity.show = true
        weaponEntity.name = weapon.name
        weaponEntity.position = new Cesium.ConstantPositionProperty(position)
        weaponEntity.description = new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
          const { active, completed } = getWepState(time)
          return `<div style="padding: 10px; font-family: inherit;background-color:white; color: rgba(0, 0, 0, 0.8); border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; color: var(--color-danger);">红方武器</h3>
            <p><strong>名称:</strong> ${weapon.name}</p>
            <p><strong>国家:</strong> ${weapon.country}</p>
            <p><strong>类型:</strong> ${weapon.type}</p>
            <p><strong>打击半径:</strong> ${weapon.range} km</p>
            <p><strong>方案状态:</strong> ${completed ? '已执行' : active ? '执行中' : '待命'}</p>
          </div>`
        }, false)

        /**
         * 更新武器的图标
         */
        if (!weaponEntity.billboard) weaponEntity.billboard = new Cesium.BillboardGraphics()
        /** 按武器类型取图标缩放，避免不同武器视觉大小不一致 */
        const weaponIconScale = getWeaponIconScale(weapon.type)
        Object.assign(weaponEntity.billboard, {
          image: createWeaponIconDataUri(weapon.type, weaponStyle.pointColor, weaponIconScale),
          scale: weaponIconScale,
          width: 28 * weaponIconScale,
          height: 28 * weaponIconScale,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          heightReference: Cesium.HeightReference.NONE,
        })

        /**
         * 更新武器的标签
         */
        if (!weaponEntity.label) weaponEntity.label = new Cesium.LabelGraphics()
        Object.assign(weaponEntity.label, {
          text: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            const { active, completed } = getWepState(time)
            return completed ? `${weapon.name}（已执行）` : active ? `${weapon.name}（执行中）` : weapon.name
          }, false),
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 18),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.35),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        })

        /**
         * 更新武器的作用范围
         */
        if (!weaponEntity.ellipse) weaponEntity.ellipse = new Cesium.EllipseGraphics()
        Object.assign(weaponEntity.ellipse, {
          semiMajorAxis: rangeMeters,
          semiMinorAxis: rangeMeters,
          material: weaponStyle.ellipseColor,
          outline: true,
          outlineColor: weaponStyle.ellipseOutlineColor,
          height: 0,
          show: new Cesium.CallbackProperty(() => isVisibleFromCamera(position), false),
        })
      }

      /**
       * 更新红方武器对应的打击链路
       */
      relatedWindows.forEach((mission) => {
        /** 链路终点卫星或地面站；场景中找不到则不画线 */
        const target = blueSatellites.value.find((satellite) => satellite.noradId === String(mission.satellite_id))
        if (!target) return

        // 创建唯一 ID
        const linkEntityId = `link-${mission.weapon_id}-${mission.satellite_id}`
        const linkEntity = getOrCreateBattleEntity(linkEntityId, {
          id: linkEntityId,
          polyline: new Cesium.PolylineGraphics(),
        })

        /**
         * 更新打击链路
         */
        if (linkEntity) {
          nextEntityIds.add(linkEntityId)//添加链路的ID
          linkEntity.show = true//显示

          if (!linkEntity.polyline) linkEntity.polyline = new Cesium.PolylineGraphics()
          Object.assign(linkEntity.polyline, {
            show: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
              //  获取打击链路的状态
              const phase = getStrikePhase(mission, Cesium.JulianDate.toDate(time))
              return phase === 'active' || phase === 'fading'
            }, false),

            /**
             * 连线的起点是武器（position），终点是目标的位置。
             * 即便是静态的地面站，这里也通过 getSatellitePositionAtTime 进行获取，
             * 底层针对基站这种固定坐标的场景会自动回退返回静态的三维笛卡尔坐标（Cartesian3）
             */
            positions: new Cesium.CallbackProperty(
              (time = new Cesium.JulianDate()) => [position, dependencies.getSatellitePositionAtTime(target, time)],//设置打击链路的位置
              false
            ),
            arcType: Cesium.ArcType.GEODESIC, // 使用大圆弧连接，让它贴着地球表面呈现优美的弧度
            width: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
              // 如果是打击固定目标（基站、雷达站），高度<=100 连线在静止的地面上，稍微加粗一点显示。
              const phase = getStrikePhase(mission, Cesium.JulianDate.toDate(time))
              const isTargetStation = target.satType === '基站' || target.satType === '雷达站' || target.altitude <= 100
              return isTargetStation && phase === 'active'
                ? 3.5 // 如果正在打击
                : getStrikeTypeStyle(weapon.type, phase, 1, 1).width
            }, false),
            material: new Cesium.ColorMaterialProperty(
              new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
                const date = Cesium.JulianDate.toDate(time)
                const phase = getStrikePhase(mission, date)
                const isTargetStation = target.satType === '基站' || target.satType === '雷达站' || target.altitude <= 100
                if (isTargetStation) {
                  // 用真实挂钟时间做闪烁基准，避免仿真倍速影响闪烁节奏导致链路近乎不可见
                  const linkBlink = phase === 'active' ? (Math.sin(performance.now() / 600) + 1) / 2 : 1
                    /** 地面目标链路透明度：打击中随闪烁变化，收尾后保持较高不透明度 */
                  const linkAlpha = phase === 'active' ? 0.55 + 0.45 * linkBlink : 0.95
                  return Cesium.Color.fromCssColorString(readThemeColor('--swatch-00f5ff')).withAlpha(0.85 * linkAlpha)
                } else {
                  // 计算打击链路的淡出比例
                  const fadeRatio =
                    phase === 'fading'
                      ? Math.max(
                        0,
                        1 -
                        (date.getTime() - parseMissionWindowDate(mission.window_end).getTime()) /
                        STRIKE_LINK_FADE_MS
                      )
                      : 1
                  // 获取打击链路的材质
                  const styleMaterial = getStrikeTypeStyle(weapon.type, phase, 1, fadeRatio).material
                  // 如果是颜色直接返回
                  if (styleMaterial instanceof Cesium.Color) return styleMaterial
                  // 如果是其他材质的颜色
                  return (
                    (
                      styleMaterial as
                      | Cesium.ColorMaterialProperty
                      | Cesium.PolylineDashMaterialProperty
                      | Cesium.PolylineGlowMaterialProperty
                      | Cesium.PolylineArrowMaterialProperty
                    ).color?.getValue(time) ?? Cesium.Color.WHITE
                  )
                }
              }, false)
            ),
          })
        }

        /**
         * 创建一个打击特效实体
         * 1. 如果存在就说明是新创建的，就添加到 nextEntityIds 中
         * 2. 如果不存在就说明是旧的，就从 nextEntityIds 中移除
         */
        const strikeEffectId = `strike-effect-${mission.weapon_id}-${mission.satellite_id}`
        const strikeEffectEntity = getOrCreateBattleEntity(strikeEffectId, {
          id: strikeEffectId,
          name: `打击特效-${mission.weapon_id}-${mission.satellite_id}`,
          point: new Cesium.PointGraphics(),
          label: new Cesium.LabelGraphics(),
        })

        /**
         * strikeEffectEntity 判断实体是否存在
         * if (strikeEffectEntity) { ... } 如果存在就说明是新创建的，就添加到 nextEntityIds 中
         * 如果不存在就说明是旧的，就从 nextEntityIds 中移除
         */
        if (strikeEffectEntity) {
          nextEntityIds.add(strikeEffectId)
          strikeEffectEntity.name = `打击特效-${mission.weapon_id}-${mission.satellite_id}`

          /**
           * 创建一个显示属性
           * 判断打击阶段，active(打击中)或fading(打击后)，如果不是这两个阶段就不显示
           */
          const effectShowProperty = new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {
            const phase = getStrikePhase(mission, Cesium.JulianDate.toDate(time))
            return phase === 'active' || phase === 'fading'
          }, false)

          /**
           * 创建一个位置属性
           * 获取目标卫星在当前时间的位置
           */
          strikeEffectEntity.position = new Cesium.CallbackProperty(
            (time) => dependencies.getSatellitePositionAtTime(target, time),
            false
          ) as unknown as Cesium.PositionProperty

          /**
           * strikeEffectEntity.point 判断实体是否存在
           * if (strikeEffectEntity.point) { ... } 如果存在就说明是新创建的，就添加到 nextEntityIds 中
           * 如果不存在就说明是旧的，就从 nextEntityIds 中移除
           */
          if (!strikeEffectEntity.point) strikeEffectEntity.point = new Cesium.PointGraphics()
          Object.assign(strikeEffectEntity.point, {
            show: effectShowProperty,
            /**
             * 设置打击特效的像素大小
             * 如果是打击中，像素大小为 18
             * 如果是打击后，像素大小为 20
             */
            pixelSize: new Cesium.CallbackProperty(
              (time = new Cesium.JulianDate()) =>
                getStrikePhase(mission, Cesium.JulianDate.toDate(time)) === 'active' ? 18 : 20,
              false
            ),
            /**
             * 设置打击特效的颜色
             * 如果是打击中，颜色为红色
             * 如果是打击后，颜色为黄色
             */
            color: new Cesium.CallbackProperty((time = new Cesium.JulianDate()) => {

              const date = Cesium.JulianDate.toDate(time)//获取当前时间
              const phase = getStrikePhase(mission, date)//获取打击阶段

              //淡出比
              const fadeRatio =
                phase === 'fading'
                  ? Math.max(
                    0,
                    1 - (date.getTime() - parseMissionWindowDate(mission.window_end).getTime()) / STRIKE_LINK_FADE_MS
                  )
                  : 1
              //获取打击阶段的样式
              return getStrikeTypeStyle(weapon.type, phase, 1, fadeRatio).effectColor

            }, false),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
          })

          if (!strikeEffectEntity.label) strikeEffectEntity.label = new Cesium.LabelGraphics()
          Object.assign(strikeEffectEntity.label, {
            show: effectShowProperty,
            font: '13px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -50),
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.45),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000000),
          })
        }
      })
    })

    /**
     * 移除不在 nextEntityIds 中的实体
     */
    hideStaleBattleEntities(nextEntityIds)

    // 重置并挂载相机跟随监听器
    if (clockFollowListener) {
      clockFollowListener()
      clockFollowListener = null
    }

    /**
     * missionWindows.length > 0 判断是否有任务窗口
     * viewer.value 判断是否有 viewer
     * 如果以上两个条件都成立，就挂载相机跟随监听器
     */
    if (missionWindows.length > 0 && viewer.value) {
      clockFollowListener = viewer.value.clock.onTick.addEventListener((clock) => {
        /** 时钟对应的绝对时间 */
        const currentDate = Cesium.JulianDate.toDate(clock.currentTime)
        /** 当前应跟随的武器、目标，以及它们窗口的开始时间（取最晚开始的进行中窗口） */
        let followWeaponId: string | null = null
        let followSatelliteId: string | null = null
        let followMissionStartTime = Number.NEGATIVE_INFINITY

        for (const mission of missionWindows) {
          /** 仅跟随正在打击的窗口 */
          const phase = getStrikePhase(mission, currentDate)
          if (phase === 'active') {
            /** 窗口开始时间，用于在多个同时进行的窗口中选最新一条 */
            const missionStartTime = parseMissionWindowDate(mission.window_start).getTime()
            if (Number.isFinite(missionStartTime) && missionStartTime >= followMissionStartTime) {
              followMissionStartTime = missionStartTime
              followWeaponId = String(mission.weapon_id)
              followSatelliteId = String(mission.satellite_id)
            }
          }
        }

        if (followWeaponId && followSatelliteId && viewer.value) {
          /** 武器与目标组合键，同一对只飞一次相机 */
          const followKey = `${followWeaponId}-${followSatelliteId}`
          if (lastStrikeFollowKey !== followKey) {
            lastStrikeFollowKey = followKey
            /** 跟随目标与武器的当前坐标，用于包住双方的包围球 */
            const target = blueSatellites.value.find((satellite) => satellite.noradId === followSatelliteId)
            const weapon = redWeapons.value.find((item, index) => String(item.id ?? index) === followWeaponId)
            if (target && weapon) {
              const targetPosition = dependencies.getSatellitePositionAtTime(target, clock.currentTime)
              const weaponPosition = Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 1500)
              /** 同时框住武器与目标的包围球 */
              const sphere = Cesium.BoundingSphere.fromPoints([weaponPosition, targetPosition])
              viewer.value.camera.flyToBoundingSphere(sphere, {
                duration: 1.8,
                offset: new Cesium.HeadingPitchRange(0, -0.6, Math.max(900000, sphere.radius * 4)),
              })
            }
          }
        } else {
          lastStrikeFollowKey = null
        }
      })
    }

    if (!skipFlyTo) dependencies.flyToScene()
    viewer.value.scene.requestRender()
  }

  // ─── 清理 ───

  /** 移除全部战场实体并重置跟踪状态 */
  const clearBattleEntities = () => {
    if (!viewer.value) return
    viewer.value.entities.removeAll()
    renderedBattleEntityIds = new Set<string>()
  }

  return {
    renderBattleEntities,
    clearBattleEntities,
  }
}
