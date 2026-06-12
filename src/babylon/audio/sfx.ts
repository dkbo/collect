/**
 * 合成音效庫：兩個原語（tone / noise）+ 配方表，復古電子遊戲風格。
 * Web Audio 節點 fire-and-forget，播完自動 GC，不需播放器池。
 * ctx 未 running（autoplay 尚未解鎖）時靜默略過。
 */
import { ensureCtx, getSfxBus, noteSfx } from './engine'

interface ToneOpts {
  type: OscillatorType
  freq: number
  /** 結束頻率（exponential 掃描） */
  freqEnd?: number
  dur: number
  vol: number
  delay?: number
  /** 絕對排程時刻（BGM 音序器用；省略則 currentTime + delay） */
  at?: number
  /** 目標匯流排（省略則 sfxBus） */
  bus?: AudioNode
}

export const tone = (o: ToneOpts): void => {
  const ctx = ensureCtx()
  if (ctx.state !== 'running') return
  const t0 = o.at ?? ctx.currentTime + (o.delay ?? 0)
  const osc = ctx.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(o.vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur)
  osc.connect(g).connect(o.bus ?? getSfxBus())
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

interface NoiseOpts {
  dur: number
  vol: number
  filter: BiquadFilterType
  freq: number
  freqEnd?: number
  delay?: number
  at?: number
  bus?: AudioNode
}

let noiseBuf: AudioBuffer | null = null

export const noise = (o: NoiseOpts): void => {
  const ctx = ensureCtx()
  if (ctx.state !== 'running') return
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = o.at ?? ctx.currentTime + (o.delay ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.filter
  f.frequency.setValueAtTime(o.freq, t0)
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(o.vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur)
  src.connect(f).connect(g).connect(o.bus ?? getSfxBus())
  src.start(t0)
  src.stop(t0 + o.dur + 0.05)
}

export type SfxName =
  | 'countdown'
  | 'go'
  | 'win'
  | 'lose'
  | 'round_end'
  | 'lap'
  | 'bomb_place'
  | 'explosion'
  | 'kill'
  | 'death'
  | 'pickup'
  | 'chop'
  | 'cook_done'
  | 'serve'
  | 'burnt'
  | 'order_new'
  | 'order_fail'
  | 'tank_fire'
  | 'tank_hit'

/** 配方：d 為基準延遲秒數（attachFlowAudio 用來對齊倒數嗶聲） */
const RECIPES: Record<SfxName, (d: number) => void> = {
  countdown: (d) => tone({ type: 'square', freq: 660, dur: 0.08, vol: 0.25, delay: d }),
  go: (d) => tone({ type: 'square', freq: 660, freqEnd: 1320, dur: 0.3, vol: 0.3, delay: d }),
  win: (d) => {
    const arp = [523.25, 659.25, 783.99, 1046.5]
    arp.forEach((f, i) => tone({ type: 'square', freq: f, dur: 0.14, vol: 0.25, delay: d + i * 0.12 }))
  },
  lose: (d) => {
    tone({ type: 'sawtooth', freq: 392, freqEnd: 277, dur: 0.25, vol: 0.25, delay: d })
    tone({ type: 'sawtooth', freq: 277, freqEnd: 196, dur: 0.35, vol: 0.25, delay: d + 0.25 })
  },
  round_end: (d) => {
    tone({ type: 'sine', freq: 783.99, dur: 0.15, vol: 0.3, delay: d })
    tone({ type: 'sine', freq: 523.25, dur: 0.3, vol: 0.3, delay: d + 0.18 })
  },
  lap: (d) => {
    tone({ type: 'sine', freq: 783.99, dur: 0.09, vol: 0.3, delay: d })
    tone({ type: 'sine', freq: 1046.5, dur: 0.12, vol: 0.3, delay: d + 0.1 })
  },
  bomb_place: (d) => tone({ type: 'sine', freq: 220, freqEnd: 110, dur: 0.15, vol: 0.35, delay: d }),
  explosion: (d) => {
    noise({ dur: 0.4, vol: 0.5, filter: 'lowpass', freq: 1200, freqEnd: 100, delay: d })
    tone({ type: 'sine', freq: 80, freqEnd: 40, dur: 0.35, vol: 0.5, delay: d })
  },
  kill: (d) => tone({ type: 'square', freq: 440, freqEnd: 110, dur: 0.3, vol: 0.25, delay: d }),
  death: (d) => tone({ type: 'sawtooth', freq: 330, freqEnd: 82, dur: 0.6, vol: 0.3, delay: d }),
  pickup: (d) => tone({ type: 'square', freq: 587, freqEnd: 1175, dur: 0.15, vol: 0.25, delay: d }),
  chop: (d) => {
    for (let i = 0; i < 3; i++) noise({ dur: 0.05, vol: 0.3, filter: 'highpass', freq: 2000, delay: d + i * 0.12 })
  },
  cook_done: (d) => {
    tone({ type: 'sine', freq: 880, dur: 0.6, vol: 0.3, delay: d })
    tone({ type: 'sine', freq: 1760, dur: 0.5, vol: 0.12, delay: d })
  },
  serve: (d) => {
    tone({ type: 'square', freq: 987.77, dur: 0.07, vol: 0.25, delay: d })
    tone({ type: 'square', freq: 1318.5, dur: 0.25, vol: 0.25, delay: d + 0.08 })
  },
  burnt: (d) => {
    // 低頻顫音蜂鳴：短促方波重複近似 8Hz 顫音
    for (let i = 0; i < 4; i++) tone({ type: 'square', freq: 150, dur: 0.07, vol: 0.25, delay: d + i * 0.125 })
  },
  order_new: (d) => {
    tone({ type: 'sine', freq: 660, dur: 0.07, vol: 0.25, delay: d })
    tone({ type: 'sine', freq: 660, dur: 0.07, vol: 0.25, delay: d + 0.12 })
  },
  order_fail: (d) => tone({ type: 'sawtooth', freq: 330, freqEnd: 165, dur: 0.3, vol: 0.25, delay: d }),
  tank_fire: (d) => {
    tone({ type: 'square', freq: 110, freqEnd: 55, dur: 0.2, vol: 0.4, delay: d })
    noise({ dur: 0.15, vol: 0.3, filter: 'lowpass', freq: 2000, freqEnd: 300, delay: d })
  },
  tank_hit: (d) => noise({ dur: 0.25, vol: 0.4, filter: 'bandpass', freq: 400, delay: d }),
}

export const playSfx = (name: SfxName, delay = 0): void => {
  RECIPES[name](delay)
  noteSfx(name)
}

// ---- 賽車引擎持續音：sawtooth 對（主 + 微失諧），音高隨速度 ----

const ENGINE_MIN_HZ = 50
const ENGINE_MAX_HZ = 140

let engineNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null

export const engineStart = (): void => {
  if (engineNodes) return
  const ctx = ensureCtx()
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  osc1.type = 'sawtooth'
  osc2.type = 'sawtooth'
  osc1.frequency.value = ENGINE_MIN_HZ
  osc2.frequency.value = ENGINE_MIN_HZ * 1.02
  const gain = ctx.createGain()
  gain.gain.value = 0.05
  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(getSfxBus())
  osc1.start()
  osc2.start()
  engineNodes = { osc1, osc2, gain }
}

/** ratio 0~1（速度比例）→ 引擎音高 */
export const engineSet = (ratio: number): void => {
  if (!engineNodes) return
  const r = Math.max(0, Math.min(1, ratio))
  const f = ENGINE_MIN_HZ + (ENGINE_MAX_HZ - ENGINE_MIN_HZ) * r
  const t = ensureCtx().currentTime
  engineNodes.osc1.frequency.setTargetAtTime(f, t, 0.05)
  engineNodes.osc2.frequency.setTargetAtTime(f * 1.02, t, 0.05)
}

export const engineStop = (): void => {
  if (!engineNodes) return
  const { osc1, osc2, gain } = engineNodes
  engineNodes = null
  osc1.stop()
  osc2.stop()
  gain.disconnect()
}
