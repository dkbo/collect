import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function vendorChunk(id: string) {
  // Babylon.js 體積大且只有 /battle 路由（lazy）的 Battle chunk 會 import，獨立成 chunk；
  // 必須最先判斷：深層路徑如 Shaders/default.vertex.js 會命中下方 'fault'／'format' 而被誤歸 vendor-syntax
  if (id.includes('@babylonjs')) {
    return 'vendor-babylon'
  }
  if (
    id.includes('react-syntax-highlighter') ||
    id.includes('prismjs') ||
    id.includes('highlight.js') ||
    id.includes('refractor') ||
    id.includes('lowlight') ||
    id.includes('character-entities') ||
    id.includes('hast-util') ||
    id.includes('parse5') ||
    id.includes('unist-util') ||
    id.includes('vfile') ||
    id.includes('fault') ||
    id.includes('format')
  ) {
    return 'vendor-syntax'
  }

  if (id.includes('lucide-react') || id.includes('lucide')) {
    return 'vendor-lucide'
  }
  // firebase 體積大且僅 /battle（lazy）使用，獨立成 chunk 以免進初始載入
  if (id.includes('/firebase/') || id.includes('@firebase')) {
    return 'vendor-firebase'
  }
  if (
    id.includes('react') ||
    id.includes('scheduler') ||
    id.includes('react-dom') ||
    id.includes('react-router') ||
    id.includes('@remix-run')
  ) {
    return 'vendor-react'
  }
  if (id.includes('node_modules') || id.includes('.pnpm')) {
    return 'vendor-others'
  }
  return null
}

// https://vite.dev/config/
export default defineConfig({
  base: '/collect/',
  // 5173 被占用時直接報錯，不要悄悄跳 5174（驗證腳本會打錯位址）；
  // git worktree 內要另起 dev server 就用 PORT=5174 pnpm dev，並把同一個 port 餵給 shot.mjs 的 --url。
  server: { strictPort: true, port: Number(process.env.PORT) || 5173 },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // 為 vendor-babylon 而設：深層匯入後實測約 1,741 kB（Babylon 核心 Engine／Scene／材質／shader 無法再切小）；
    // bomber 美術加上陰影、GlowLayer、描邊、DefaultRenderingPipeline 後實測約 2,001 kB（gzip 451 kB），上限取 +10%；
    // 注意此值全域生效，其他 chunk 也一併放寬到這個門檻
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            // vite 的 __vitePreload helper 要比 vendor 分組先認領：分組預設會遞迴收進依賴，
            // Babylon 內部的動態 import（shader 等）依賴它，同優先度下會被併進 vendor-babylon，
            // 導致 entry 為了這個 helper 在每一頁都 modulepreload 整包 Babylon
            { name: 'preload-helper', test: /vite\/preload-helper/, priority: 1 },
            { name: vendorChunk }
          ]
        }
      }
    }
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
