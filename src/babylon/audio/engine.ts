/**
 * Web Audio 引擎單例：AudioContext 延遲建立 + 匯流排 + 靜音 + autoplay 處理。
 *
 * 節點圖：sfxBus ─┬→ master → destination
 *          bgmBus ─┘
 * 靜音 = master.gain = 0（不 suspend，保持 BGM 排程時序，恢復時無縫）。
 * 瀏覽器 autoplay policy：以捕獲階段手勢監聽 resume；resume 前的音效靜默略過。
 */

const MUTE_KEY = 'battle-muted'

interface AudioDebug {
  state: AudioContextState | 'none'
  muted: boolean
  bgm: string | null
  recent: string[]
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let bgmBus: GainNode | null = null
let muted = localStorage.getItem(MUTE_KEY) === '1'

/** 驗證用旗標（Playwright 斷言音效行為） */
const debug: AudioDebug = { state: 'none', muted, bgm: null, recent: [] }
;(window as unknown as Record<string, unknown>).__AUDIO_DEBUG = debug

export const ensureCtx = (): AudioContext => {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.connect(master)
    bgmBus = ctx.createGain()
    bgmBus.gain.value = 0.12 // BGM 壓低於音效之下
    bgmBus.connect(master)
    ctx.addEventListener('statechange', () => {
      debug.state = ctx?.state ?? 'none'
    })
  }
  debug.state = ctx.state
  return ctx
}

export const getSfxBus = (): GainNode => {
  ensureCtx()
  return sfxBus!
}

export const getBgmBus = (): GainNode => {
  ensureCtx()
  return bgmBus!
}

export const getMuted = (): boolean => muted

export const setMuted = (m: boolean): void => {
  muted = m
  localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  if (master) master.gain.value = m ? 0 : 1
  debug.muted = m
}

export const noteSfx = (name: string): void => {
  debug.recent.push(name)
  if (debug.recent.length > 20) debug.recent.shift()
}

export const noteBgm = (name: string | null): void => {
  debug.bgm = name
}

// 第一個使用者手勢即 resume（玩家必先點按鈕/畫面取焦點）
const tryResume = (): void => {
  if (ctx && ctx.state !== 'running') void ctx.resume()
}
window.addEventListener('pointerdown', tryResume, true)
window.addEventListener('keydown', tryResume, true)
