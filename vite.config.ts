import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/collect/',
  // 5173 被占用時直接報錯，不要悄悄跳 5174（驗證腳本會打錯位址）
  server: { strictPort: true },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
          // Babylon.js 體積大且僅 /battle（lazy）使用，獨立成 chunk
          if (id.includes('@babylonjs')) {
            return 'vendor-babylon'
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
