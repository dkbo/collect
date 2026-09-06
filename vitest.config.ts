import { defineConfig } from 'vitest/config'
import path from 'path'

// 只測純邏輯：src/babylon 的 math / net、Zustand store。UI 與 3D 渲染不進單測（改用 web-verifier 截圖）。
// 兩個 project 分環境：babylon 用 node；store 會碰 window / localStorage / postMessage，用 jsdom。
const alias = { '@': path.resolve(__dirname, './src') }

export default defineConfig({
  resolve: { alias },
  test: {
    restoreMocks: true,
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: { name: 'babylon', include: ['src/babylon/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'store', include: ['src/store/**/*.test.ts', 'src/lib/**/*.test.ts'], environment: 'jsdom' },
      },
    ],
  },
})
