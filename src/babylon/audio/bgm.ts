/**
 * BGM：lookahead 音序器（Chris Wilson 模式）+ 四首循環曲。
 * setInterval(25ms) 醒來，把 0.1s 內到期的音符以 Web Audio 時鐘精準排程，
 * 不受 JS timer 抖動影響。16 steps = 兩小節八分音符循環。
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
const A1 = 55, E2 = 82.41, G2 = 98, A2 = 110, B2 = 123.47
const C2 = 65.41, D2 = 73.42, F2 = 87.31, G1 = 49
const D4 = 293.66, E4 = 329.63, G4 = 392, A4 = 440, Bb4 = 466.16
const C5 = 523.25, D5 = 587.33, E5 = 659.25
const A3 = 220, C4 = 261.63, E3 = 164.81

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
  // 緊張感：E 小調斷奏 bass + 稀疏三全音 lead（E↔Bb）
  bomber: {
    bpm: 108,
    bassType: 'square',
    leadType: 'square',
    bass: [E2, null, E2, null, G2, null, E2, null, E2, null, G2, null, A2, null, B2, null],
    lead: [null, null, E4, null, null, null, Bb4, null, null, null, E4, null, null, null, D4, null],
    kick: [0, 4, 8, 12],
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
      scheduleStep(step % 16, nextTime)
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
