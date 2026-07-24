/**
 * SVG 图标生成函数
 * 从 SatelliteUnReal.vue 提取，用于在 Cesium 场景中为不同武器类型和打击状态生成 SVG 图标
 */
import * as Cesium from 'cesium'

/** 根据武器类型获取图标缩放比例 */
export const getWeaponIconScale = (weaponType: string): number => {
  const normalizedType = weaponType.trim()

  if (normalizedType.includes('电子干扰')) return 1
  if (normalizedType.includes('动能')) return 1
  if (normalizedType.includes('定向能')) return 1
  if (normalizedType.includes('天基')) return 1
  return 0.8
}

/**
 * 生成武器图标的 SVG data URI
 * 根据武器类型（电子干扰/动能/定向能/天基）生成不同形状的 SVG 图标
 */
export const createWeaponIconDataUri = (weaponType: string, color: Cesium.Color, iconScale = 1): string => {
  const normalizedType = weaponType.trim()
  const solidColor = Cesium.Color.clone(color, new Cesium.Color())
  solidColor.alpha = 1
  const fillColor = solidColor.toCssColorString()
  const strokeColor = '#ffffff'

  const wrap = (body: string) =>
    `
    <svg xmlns="http://www.w3.org/2000/svg" width="${28 * iconScale}" height="${28 * iconScale}" viewBox="0 0 28 28">
      ${body}
    </svg>
  `.trim()

  let svg = wrap(`
    <circle cx="14" cy="14" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
    <path d="M8.8 18.2 19.1 9.9" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
    <path d="M18.4 8.4 21 11l-2.3.8-.9 2.1-2-2.1.8-2.2Z" fill="${strokeColor}"/>
    <path d="M8 18.9l2.7-1 .4 3.1-1.4-1-1.3 1.7-.9-.7 1.3-1.7Z" fill="${strokeColor}"/>
  `)

  if (normalizedType.includes('电子干扰')) {
    svg = wrap(`
      <circle cx="14" cy="14" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      <rect x="12.4" y="13" width="3.2" height="7" rx="1.2" fill="${strokeColor}"/>
      <rect x="10.2" y="19" width="7.6" height="1.8" rx="0.9" fill="${strokeColor}"/>
      <path d="M14 8.1v4.6" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.3 12.8a4.2 4.2 0 0 1 0-5.6" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M17.7 7.2a4.2 4.2 0 0 1 0 5.6" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M7.7 14a7.7 7.7 0 0 1 0-8" fill="none" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M20.3 6a7.7 7.7 0 0 1 0 8" fill="none" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round"/>
    `)
  } else if (normalizedType.includes('动能')) {
    svg = wrap(`
      <circle cx="14" cy="14" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      <path d="M8.2 18.2 16.9 9.5l2.9.3.2 2.9-8.8 8.8-1.1-2.3-2.3-1Z" fill="${strokeColor}"/>
      <path d="M16.7 9.3 19.9 6l2.1 2.1-3.2 3.2" fill="${strokeColor}"/>
      <path d="M8.9 18.9 6.4 21.4" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.9 20.8 9 22.7" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M13.8 12.6l1.6 1.6" stroke="${fillColor}" stroke-width="1.2" stroke-linecap="round"/>
    `)
  } else if (normalizedType.includes('定向能')) {
    svg = wrap(`
      <circle cx="14" cy="14" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      <rect x="7.2" y="16.8" width="8.4" height="2.2" rx="1.1" fill="${strokeColor}"/>
      <rect x="10.8" y="12.3" width="4.6" height="5" rx="1.2" fill="${strokeColor}"/>
      <path d="M14 12.4 18.5 8" stroke="${strokeColor}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M18.1 8.2 22 4.2" stroke="${strokeColor}" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M17.6 10.2 22.8 5" stroke="${strokeColor}" stroke-width="1" stroke-linecap="round"/>
      <circle cx="20.9" cy="6.2" r="1.8" fill="${strokeColor}"/>
      <path d="M20.9 3.8v-1.1M23.1 6.2h1.1M20.9 8.6v1.1M18.7 6.2h-1.1" stroke="${strokeColor}" stroke-width="0.9" stroke-linecap="round"/>
    `)
  } else if (normalizedType.includes('天基')) {
    svg = wrap(`
      <circle cx="14" cy="14" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      <rect x="11.1" y="11.2" width="5.8" height="5.8" rx="1.1" fill="${strokeColor}"/>
      <rect x="6.1" y="11.8" width="4.2" height="4.6" rx="0.6" fill="none" stroke="${strokeColor}" stroke-width="1.3"/>
      <rect x="17.7" y="11.8" width="4.2" height="4.6" rx="0.6" fill="none" stroke="${strokeColor}" stroke-width="1.3"/>
      <path d="M10.3 14.1h1M16.9 14.1h.8" stroke="${strokeColor}" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M14 17v4.1" stroke="${strokeColor}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M14 21.1 12.2 23.5" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M14 21.1 15.8 23.5" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M11.7 10.4 14 8.2l2.3 2.2" fill="none" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `)
  }

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/**
 * 创建打击卫星图标（多角星形）
 * 用于表示已打击或正在打击中的卫星
 */
export const createSatelliteStrikeStarDataUri = (color: Cesium.Color, iconScale = 1): string => {
  const solidColor = Cesium.Color.clone(color, new Cesium.Color())
  solidColor.alpha = 1
  const fillColor = solidColor.toCssColorString()
  const strokeColor = '#ffffff'
  const size = 30 * iconScale
  const center = 14
  const outerRadius = 12
  const innerRadius = 8
  const points = Array.from({ length: 24 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 12
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const x = center + radius * Math.cos(angle)
    const y = center + radius * Math.sin(angle)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
      <polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="14" cy="14" r="3.1" fill="${strokeColor}"/>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/**
 * 创建基站爆炸菱形图标
 * 用于低/中烈度杀伤链方案中已打击的地面站
 */
export const createStationExplosionDiamondDataUri = (color: Cesium.Color, iconScale = 1): string => {
  const solidColor = Cesium.Color.clone(color, new Cesium.Color())
  solidColor.alpha = 1
  const strokeColor = solidColor.toCssColorString()
  const fillColor = 'rgba(239, 107, 115, 0.25)'
  const size = 32 * iconScale
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
      <polygon points="16,2 30,16 16,30 2,16" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="16,6 26,16 16,26 6,16" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2,2"/>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
