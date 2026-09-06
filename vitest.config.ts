import { defineConfig } from 'vitest/config'
import path from 'path'

// 只測純邏輯：src/babylon 的 math / net、src/core 的 mesh 閘門、Zustand store。
// UI 與 3D 渲染不進單測（改用 web-verifier 截圖）。
// 分環境：babylon / core 用 node；store 會碰 window / localStorage / postMessage，用 jsdom。
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
      {
        // core：WebRTC mesh 的 signaling 閘門（Firestore 與 RTCPeerConnection 皆 mock）
        extends: true,
        test: { name: 'core', include: ['src/core/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
})
