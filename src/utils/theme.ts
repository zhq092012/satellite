/**
 * Element Plus CSS 变量主题切换（light / dark 预设）。
 * 通过 `document.documentElement` 注入 `--el-color-*` 覆盖默认主题色。
 */

/** 支持的主题名 */
type Theme = 'light' | 'dark'

/** 各主题对应的 CSS 变量表 */
const themes: Record<Theme, Record<string, string>> = {
  light: {
    '--el-color-primary': '#409eff',
    '--el-color-success': '#67c23a',
  },
  dark: {
    '--el-color-primary': '#ff0000',
    '--el-color-success': '#00ff00',
  },
}

/**
 * 切换全局 Element Plus 主题变量。
 *
 * @param theme 主题名
 */
export function switchTheme(theme: Theme) {
  const variables = themes[theme]
  Object.keys(variables).forEach((key) => {
    document.documentElement.style.setProperty(key, variables[key])
  })
}
