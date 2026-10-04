import type { StickerTone } from '@/components/toybox'

export const SKILL_ITEMS = [
  // 核心框架與語言
  { text: 'Vue2 / Vue3', weight: 6 },
  { text: 'React', weight: 6 },
  { text: 'TypeScript', weight: 6 },
  { text: 'JavaScript (ES6+)', weight: 6 },
  // 框架生態與工程化
  { text: 'Nuxt.js', weight: 4 },
  { text: 'Next.js', weight: 4 },
  { text: 'Pinia', weight: 4 },
  { text: 'Vuex', weight: 4 },
  { text: 'TailwindCSS', weight: 4 },
  { text: 'Vite', weight: 4 },
  { text: 'Webpack', weight: 4 },
  { text: 'Node.js', weight: 4 },
  { text: 'SSR / SPA', weight: 4 },
  { text: 'Micro Frontend', weight: 4 },
  // AI 協作工具
  { text: 'Claude Code', weight: 6 },
  { text: 'AI Agent Workflow', weight: 4 },
  { text: 'Prompt Engineering', weight: 4 },
  { text: 'Codex CLI', weight: 3 },
  { text: 'Vibe Coding', weight: 3 },
  // 基礎與工具鏈
  { text: 'HTML', weight: 3 },
  { text: 'CSS / Sass', weight: 3 },
  { text: 'Headless UI', weight: 3 },
  { text: 'Docker', weight: 3 },
  { text: 'Nginx', weight: 3 },
  { text: 'Git', weight: 3 },
  { text: 'ESLint', weight: 3 },
  { text: 'Azure DevOps CI/CD', weight: 3 },
  { text: 'WSL2 / Linux', weight: 3 },
  { text: '效能優化', weight: 3 },
] as const

const WEIGHT4_TONES: StickerTone[] = ['sky', 'mint', 'pink']

/** 技能權重 → Tag 外觀（pages-spec §7）；nth 為同權重內的序號 */
export function skillTagStyle(weight: number, nth: number): { size: 's' | 'l'; tone: StickerTone } {
  if (weight >= 6) return { size: 'l', tone: 'pop' }
  if (weight === 4) return { size: 's', tone: WEIGHT4_TONES[nth % WEIGHT4_TONES.length] }
  return { size: 's', tone: 'plain' }
}

/** 狀態圖的舊色名 → 貼紙色 */
export const CHART_TONE = { green: 'mint', blue: 'sky', red: 'pink' } as const satisfies Record<string, StickerTone>
