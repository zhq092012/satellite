/**
 * 生成八角星（爆炸）图标的 Data URL，用于 Cesium Billboard。
 *
 * @param size 画布边长（像素）
 * @returns PNG Data URL
 */
export const createOctagonStarExplosionDataUrl = (size = 72): string => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.42
  const innerR = size * 0.18

  ctx.clearRect(0, 0, size, size)
  ctx.beginPath()
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI / 8) * i - Math.PI / 2
    const radius = i % 2 === 0 ? outerR : innerR
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  const gradient = ctx.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, outerR)
  gradient.addColorStop(0, 'rgba(255, 250, 220, 0.98)')
  gradient.addColorStop(0.45, 'rgba(255, 160, 40, 0.95)')
  gradient.addColorStop(1, 'rgba(255, 60, 20, 0.85)')
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.9)'
  ctx.lineWidth = 2
  ctx.stroke()

  return canvas.toDataURL('image/png')
}
