/**
 * 读取全局主题色，供 Cesium 等不能直接写 CSS 变量的地方使用。
 * 色值只定义在 `src/styles/tokens.scss`。
 *
 * @param variableName 形如 `--accent-cyan` 的 CSS 变量名
 * @returns 去掉空白后的颜色字符串
 * @throws 页面上没有该变量时抛出，避免静默退回另一套颜色
 */
export function readThemeColor(variableName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  if (!value) {
    throw new Error(`缺少主题变量 ${variableName}，请在 src/styles/tokens.scss 中定义`)
  }
  return value
}
