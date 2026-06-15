/**
 * BGM：lookahead 音序器（Chris Wilson 模式）+ 四首循環曲。
 * setInterval(25ms) 醒來，把 0.1s 內到期的音符以 Web Audio 時鐘精準排程，
 * 不受 JS timer 抖動影響。循環步數依各曲 pattern 長度（bass.length）而定：
 * 16 step = 兩小節、32 step = 四小節八分音符循環。
 */
import type { GameType } from '@/core/room'
import { ensureCtx, getBgmBus, noteBgm } from './engine'
import { noise, tone } from './sfx'

interface Song {
  /** 每 step = 八分音符 */
  bpm: number
  bassType: OscillatorType
  leadType: OscillatorType
  bass: (number | null)[]
  lead: (number | null)[]
  /** highpass noise tick 的 step */
  hat?: number[]
  /** sine 100→45Hz thump 的 step */
  kick?: number[]
  /** bandpass noise 軍鼓的 step */
  snare?: number[]
}

// 音名頻率（Hz）
const A1 = 55, E2 = 82.41, G2 = 98, A2 = 110
const C2 = 65.41, D2 = 73.42, F2 = 87.31, G1 = 49
const E4 = 329.63, G4 = 392, A4 = 440
const C5 = 523.25, D5 = 587.33, E5 = 659.25
const A3 = 220, C4 = 261.63, E3 = 164.81
const C3 = 130.81, D3 = 146.83, F4 = 349.23, B4 = 493.88

const SONGS: Record<GameType, Song> = {
  // 快節奏驅動感：A 小調推進 bass + 五聲反拍 riff
  race: {
    bpm: 152,
    bassType: 'sawtooth',
    leadType: 'square',
    bass: [A1, A1, C2, C2, D2, D2, E2, E2, A1, A1, C2, C2, G1, G1, E2, E2],
    lead: [null, A4, null, C5, null, E5, null, D5, null, A4, null, C5, null, E5, D5, C5],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  // 明快驅動的 chiptune：4 小節 (32 step) Am–F–C–G 進行，前後半旋律變化避免單調；
  // galloping square bass + 全程反拍 hat + boom-chick backbeat 鼓組，帶出緊湊歡快的炸彈人戰鬥感。
  bomber: {
    bpm: 144,
    bassType: 'square',
    leadType: 'square',
    bass: [
      A1, A1, E2, A1, A2, A1, E2, A1, // Am
      F2, F2, C3, F2, F2, F2, C3, F2, // F
      C2, C2, G2, C2, C3, C2, G2, C2, // C
      G2, G2, D3, G2, G2, G2, D3, G2, // G
    ],
    lead: [
      A4, null, C5, null, E5, null, D5, C5, // Am：上行小調 hook
      A4, null, F4, null, A4, null, C5, null, // F：落點
      G4, null, C5, null, E5, null, D5, E5, // C：再起、變化句
      D5, null, B4, null, G4, null, B4, null, // G：下行收束、導回
    ],
    hat: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
    kick: [0, 4, 8, 12, 16, 20, 24, 28],
    snare: [2, 6, 10, 14, 18, 22, 26, 30],
  },
  // 輕快：C 大調跳躍 bass + 五聲旋律 + 反拍 hat
  overcooked: {
    bpm: 126,
    bassType: 'triangle',
    leadType: 'square',
    bass: [C2, null, G2, null, C2, null, G2, null, F2, null, C2, null, G2, null, C2, null],
    lead: [E4, G4, null, C5, null, G4, A4, null, E4, G4, null, C5, D5, null, G4, null],
    hat: [1, 3, 5, 7, 9, 11, 13, 15],
  },
  // 進行曲戰鬥感：五度持續低音脈動 + 軍鼓
  tank: {
    bpm: 96,
    bassType: 'square',
    leadType: 'triangle',
    bass: [A1, null, A1, null, E2, null, A1, null, A1, null, A1, null, E2, null, G2, null],
    lead: [null, null, null, null, A3, null, null, null, null, null, C4, null, E3, null, null, null],
    kick: [0, 8],
    snare: [4, 12],
  },
}

let timer: ReturnType<typeof setInterval> | null = null

export const startBgm = (game: GameType): void => {
  stopBgm()
  const ctx = ensureCtx()
  const song = SONGS[game]
  const bus = getBgmBus()
  const stepDur = 30 / song.bpm // 八分音符
  const len = song.bass.length // 循環步數（各曲可不同：16=兩小節、32=四小節…）
  let step = 0
  let nextTime = ctx.currentTime + 0.05

  const scheduleStep = (i: number, at: number): void => {
    const b = song.bass[i]
    if (b) tone({ type: song.bassType, freq: b, dur: stepDur * 0.85, vol: 0.5, at, bus })
    const l = song.lead[i]
    if (l) tone({ type: song.leadType, freq: l, dur: stepDur * 0.9, vol: 0.3, at, bus })
    if (song.hat?.includes(i)) noise({ dur: 0.03, vol: 0.15, filter: 'highpass', freq: 6000, at, bus })
    if (song.kick?.includes(i)) tone({ type: 'sine', freq: 100, freqEnd: 45, dur: 0.12, vol: 0.7, at, bus })
    if (song.snare?.includes(i)) noise({ dur: 0.09, vol: 0.35, filter: 'bandpass', freq: 1800, at, bus })
  }

  timer = setInterval(() => {
    // ctx suspended 時 currentTime 凍結，迴圈自然暫停，resume 後無縫接續
    while (nextTime < ctx.currentTime + 0.1) {
      scheduleStep(step % len, nextTime)
      nextTime += stepDur
      step++
    }
  }, 25)
  noteBgm(game)
}

export const stopBgm = (): void => {
  if (timer) clearInterval(timer)
  timer = null
  noteBgm(null)
}
