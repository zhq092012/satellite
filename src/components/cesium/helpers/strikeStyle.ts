/**
 * 打击样式计算
 * 根据武器类型和打击阶段计算视觉样式（颜色、线宽、材质等）
 */
import * as Cesium from 'cesium'
import type { StrikePhase, StrikeTypeStyle } from '../types'
import { parseMissionWindowDate } from './dateFormat'
import type { StrikePlanV2MissionWindowItem } from '@/api/strikePlan/satellite-strikeplan-api'


/**
 * 打击链路淡出时间
 */
export const STRIKE_LINK_FADE_MS = 1400
/**
 * 卫星闪烁时间
 */
export const STRIKE_SATELLITE_BLINK_MS = 240

/**
 * 混合两个颜色，根据指定的比例和透明度生成新的颜色
 * @param left 左侧颜色
 * @param right 右侧颜色
 * @param amount 混合比例，取值范围为 0 到 1
 * @param alpha 透明度，默认值为 1
 */
export const mixColor = (left: Cesium.Color, right: Cesium.Color, amount: number, alpha = 1): Cesium.Color => {
  const result = Cesium.Color.lerp(left, right, Math.min(1, Math.max(0, amount)), new Cesium.Color())
  result.alpha = alpha
  return result
}

/**
 * 根据任务的时间窗口和当前时间，计算任务的打击阶段
 * - idle：当前时间在任务开始之前
 * - active：当前时间在任务的开始和结束之间
 * - fading：当前时间在任务结束之后，打击效果淡出中
 * - done：打击效果已完全消失
 */
export const getStrikePhase = (
  mission: StrikePlanV2MissionWindowItem,
  currentDate: Date
): StrikePhase => {
  //开始时间
  const start = parseMissionWindowDate(mission.window_start)
  //结束时间
  const end = parseMissionWindowDate(mission.window_end)
  //判断时间是否有效
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'idle'

  //当前时间小于开始时间，为idle
  if (currentDate < start) return 'idle'

  //当前时间在开始和结束之间，为active
  if (currentDate >= start && currentDate <= end) return 'active'

  //当前时间大于结束时间且小于结束时间加淡出时间，为fading
  if (currentDate.getTime() <= end.getTime() + STRIKE_LINK_FADE_MS) return 'fading'

  //当前时间大于结束时间加淡出时间，为done
  return 'done'
}

/**
 * 根据武器类型和阶段获取打击类型的视觉样式
 * 包括线条宽度、颜色、点颜色、椭圆颜色、卫星颜色和特效颜色
 */
export const getStrikeTypeStyle = (
  weaponType: string,
  phase: StrikePhase,
  blinkRatio = 1,
  fadeRatio = 1
): StrikeTypeStyle => {
  const normalizedType = weaponType.trim()
  const runtimeAlpha = phase === 'fading' ? Math.max(0.08, fadeRatio) : phase === 'active' ? 1 : 0.8

  const createColor = (hex: string, alpha = 1) => Cesium.Color.fromCssColorString(hex).withAlpha(alpha)
  const linkAlpha = phase === 'fading' ? Math.max(0.05, 0.95 * fadeRatio) : phase === 'active' ? 0.95 : 0.55
  const activeBlinkAlpha = phase === 'active' ? 0.7 + 0.3 * blinkRatio : 1
  const pointAlpha = phase === 'fading' ? Math.max(0.12, 0.9 * fadeRatio) : phase === 'active' ? activeBlinkAlpha : 0.85
  const satelliteAlpha = phase === 'fading' ? Math.max(0.15, 0.95 * fadeRatio) : phase === 'active' ? 1 : 0.95

  if (normalizedType.includes('电子干扰')) {
    return {
      width: phase === 'active' ? 2.5 : phase === 'fading' ? 2.2 * Math.max(0.55, fadeRatio) : 2,
      material: new Cesium.PolylineDashMaterialProperty({
        color: createColor('#b15cff', 0.5 * linkAlpha),
        gapColor: createColor('#b15cff', 0.15 * linkAlpha),
        dashLength: 16,
      }),
      pointColor: createColor('#b15cff', pointAlpha),
      ellipseColor: createColor('#b15cff', phase === 'active' ? 0.14 : phase === 'fading' ? 0.12 * fadeRatio : 0.08),
      ellipseOutlineColor: createColor(
        '#b15cff',
        phase === 'active' ? 0.6 : phase === 'fading' ? 0.55 * fadeRatio : 0.45
      ),
      satelliteColor: createColor('#b15cff', satelliteAlpha),
      effectColor: createColor('#b15cff', phase === 'active' ? 0.8 : phase === 'fading' ? 0.8 * fadeRatio : 0.75),
    }
  }

  if (normalizedType.includes('动能')) {
    return {
      width: phase === 'active' ? 1.5 : phase === 'fading' ? 1.3 * Math.max(0.55, fadeRatio) : 1,
      material: Cesium.Color.RED.withAlpha(0.95 * linkAlpha),
      pointColor: createColor('#ef6b73', pointAlpha),
      ellipseColor: createColor('#ef6b73', phase === 'active' ? 0.14 : phase === 'fading' ? 0.12 * fadeRatio : 0.08),
      ellipseOutlineColor: createColor(
        '#ef6b73',
        phase === 'active' ? 0.6 : phase === 'fading' ? 0.55 * fadeRatio : 0.45
      ),
      satelliteColor: createColor('#ef6b73', satelliteAlpha),
      effectColor: createColor('#ef6b73', phase === 'active' ? 0.85 : phase === 'fading' ? 0.85 * fadeRatio : 0.8),
    }
  }

  if (normalizedType.includes('定向能')) {
    return {
      width: phase === 'active' ? 4.5 : phase === 'fading' ? 4.2 * Math.max(0.55, fadeRatio) : 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: createColor('#7cd992', 0.7 * linkAlpha),
      }),
      pointColor: createColor('#7cd992', pointAlpha),
      ellipseColor: createColor('#7cd992', phase === 'active' ? 0.14 : phase === 'fading' ? 0.12 * fadeRatio : 0.08),
      ellipseOutlineColor: createColor(
        '#7cd992',
        phase === 'active' ? 0.6 : phase === 'fading' ? 0.55 * fadeRatio : 0.45
      ),
      satelliteColor: createColor('#7cd992', satelliteAlpha),
      effectColor: createColor('#7cd992', phase === 'active' ? 0.85 : phase === 'fading' ? 0.85 * fadeRatio : 0.8),
    }
  }

  if (normalizedType.includes('天基')) {
    return {
      width: phase === 'active' ? 5.5 : phase === 'fading' ? 5 * Math.max(0.6, fadeRatio) : 4.5,
      material: new Cesium.PolylineArrowMaterialProperty(createColor('#8cc6ff', 0.7 * linkAlpha)),
      pointColor: createColor('#8cc6ff', pointAlpha),
      ellipseColor: createColor('#8cc6ff', phase === 'active' ? 0.12 : phase === 'fading' ? 0.1 * fadeRatio : 0.07),
      ellipseOutlineColor: createColor(
        '#f4fbff',
        phase === 'active' ? 0.62 : phase === 'fading' ? 0.58 * fadeRatio : 0.5
      ),
      satelliteColor: createColor('#8cc6ff', satelliteAlpha),
      effectColor: createColor('#8cc6ff', phase === 'active' ? 0.85 : phase === 'fading' ? 0.85 * fadeRatio : 0.8),
    }
  }

  // 默认样式（未知武器类型）
  return {
    width: phase === 'active' ? 3.5 : phase === 'fading' ? 3.1 * Math.max(0.55, fadeRatio) : 2.5,
    material: Cesium.Color.fromCssColorString('#ef6b73').withAlpha(runtimeAlpha),
    pointColor: createColor('#ef6b73', pointAlpha),
    ellipseColor: createColor('#ef6b73', phase === 'active' ? 0.14 : phase === 'fading' ? 0.12 * fadeRatio : 0.08),
    ellipseOutlineColor: createColor(
      '#ef6b73',
      phase === 'active' ? 0.6 : phase === 'fading' ? 0.55 * fadeRatio : 0.45
    ),
    satelliteColor: createColor('#ef6b73', satelliteAlpha),
    effectColor: createColor('#ef6b73', phase === 'active' ? 0.85 : phase === 'fading' ? 0.85 * fadeRatio : 0.8),
  }
}
