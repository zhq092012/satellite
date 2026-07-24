// 定义主题类型
type Theme = "light" | "dark";

// 主题配置
const themes: Record<Theme, Record<string, string>> = {
  light: {
    "--el-color-primary": "#409eff",
    "--el-color-success": "#67c23a",
  },
  dark: {
    "--el-color-primary": "#ff0000",
    "--el-color-success": "#00ff00",
  },
};

// 切换主题方法
export function switchTheme(theme: Theme) {
  const variables = themes[theme];
  Object.keys(variables).forEach((key) => {
    document.documentElement.style.setProperty(key, variables[key]);
  });
}
