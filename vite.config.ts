import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 显式设置环境模式
  process.env.NODE_ENV = mode

  const viteEnv = loadEnv(mode, process.cwd(), '')

  return {
    // 确保构建时能正确识别环境
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    base: viteEnv.VITE_BASE_ROUTER,
    plugins: (() => {
      // 基础插件列表
      const p: any[] = [vue()]
      // 自动导入和组件按需加载插件（将 ElementPlus 样式导入方式设为 sass）
      const elementResolver = ElementPlusResolver({ importStyle: 'sass' })
      p.push(AutoImport({ resolvers: [elementResolver] }), Components({ resolvers: [elementResolver] }))
      return p
    })(),
    resolve: {
      extensions: ['.js', '.vue', '.ts', '.json'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: ['legacy-js-api'],
          additionalData: `@use "@/styles/element/index.scss" as *;`,
        },
      },
    },
    server: {
      hmr: true,
      port: 7102,
      open: false,
      host: '0.0.0.0',
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      proxy: {
        '/media': {
          target: 'http://localhost:31280', //地球材质
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, ''),
        },
        '/image': {
          target: 'http://192.168.100.21:31298', //卫星图片
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/image/, ''),
        },
        '/api': {
          // target: 'http://192.168.100.12:32180',
          target: 'http://192.168.52.72:34126',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    worker: {
      format: 'es'
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm']
    },
    build: {
      // 样式和脚本优化
      cssCodeSplit: true, // 启用CSS代码分割
      // minify: 'terser', // 使用terser进行更彻底的压缩
      // terserOptions: {
      //   compress: {
      //     drop_console: true, // 移除console
      //     drop_debugger: true, // 移除debugger
      //   },
      // },
      // 图片资源处理
      assetsInlineLimit: 4096, // 小于4KB的图片转为base64
      // 产物文件名规则
      rollupOptions: {
        output: {
          compact: true, // 压缩空白
          hoistTransitiveImports: false, // 避免重复导入
          entryFileNames: `assets/[name].[hash].js`,
          chunkFileNames: `assets/[name].[hash].js`,
          assetFileNames: `assets/[name].[hash].[ext]`,
        },
      },
      // 生成 manifest.json 便于后端或子应用加载资源
      manifest: true,
      // 使用 Vite/Esbuild 的内置压缩（更快），不再使用 terser 自定义
      minify: 'esbuild',
      // 设置目标环境（影响压缩和语法转换）
      target: 'es2015',
      // 启用 Rollup 的 treeshake 选项已合并至上方 rollupOptions 中
      outDir: 'docker/dist',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
  }
})
