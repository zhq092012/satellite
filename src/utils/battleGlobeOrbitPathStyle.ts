import * as Cesium from 'cesium'

/** 态势地球卫星轨道线宽（像素，选中 path 与推演轨迹共用） */
export const BATTLE_GLOBE_ORBIT_PATH_WIDTH = 2

/** 态势地球卫星轨道发光强度 */
export const BATTLE_GLOBE_ORBIT_PATH_GLOW_POWER = 0.25

/** 态势地球卫星轨道颜色（CSS） */
export const BATTLE_GLOBE_ORBIT_PATH_COLOR_CSS = '#fde047'

/**
 * 创建态势地球卫星轨道发光材质（选中 path / 推演折线共用）。
 *
 * @returns PolylineGlow 材质
 */
export const createBattleGlobeOrbitGlowMaterial = (): Cesium.PolylineGlowMaterialProperty =>
  new Cesium.PolylineGlowMaterialProperty({
    glowPower: BATTLE_GLOBE_ORBIT_PATH_GLOW_POWER,
    color: Cesium.Color.fromCssColorString(BATTLE_GLOBE_ORBIT_PATH_COLOR_CSS),
  })
