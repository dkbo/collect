import { describe, it, expect } from 'vitest'
import {
  BOX_POP_MS,
  CLASH_COOLDOWN_MS,
  CLASH_SPEED,
  DROP_H,
  DROP_MS,
  GHOST_DIM,
  LAND_MS,
  SHAKE_AMP,
  SHAKE_MS,
  boostColor,
  boxPopScale,
  chunkPose,
  clashKey,
  clashReady,
  driftSparkLook,
  SPARK_SIZE,
  sparkHot,
  finishConfetti,
  finishEdges,
  ghostVisibility,
  lapCardPose,
  landSquash,
  relSpeed,
  respawnDropY,
  shakeAmp,
  shakeAllowed,
  shieldPose,
  skidScale,
  slipLook,
  speedLineAlpha,
  speedLineCap,
  spinPose,
  mushroomPose,
  dyingBananaPose,
} from '@/babylon/games/raceFx/fxModel'
import { DRIFT_COLORS } from '@/babylon/games/raceFx/palette'

describe('raceFx/fxModel — 重生（spec §6、§8 #13）', () => {
  it('閃爍：visibility 1↔0.3 方波 10Hz，到期後恆為 1', () => {
    const until = 1500
    const seen = new Set<number>()
    for (let t = 0; t < until; t += 25) seen.add(ghostVisibility(t, until))
    expect([...seen].sort()).toEqual([GHOST_DIM, 1])
    expect(GHOST_DIM).toBe(0.3)
    expect(ghostVisibility(until, until)).toBe(1)
    expect(ghostVisibility(until + 10, until)).toBe(1)
    // 10Hz：每 50ms 換一次相位
    expect(ghostVisibility(1000, 1500)).not.toBe(ghostVisibility(1050, 1500))
    expect(ghostVisibility(1000, 1500)).toBe(ghostVisibility(1100, 1500))
  })

  it('落下：y 3 → 0（easeIn 280ms），範圍外為 0', () => {
    expect(respawnDropY(0)).toBe(DROP_H)
    expect(DROP_H).toBe(3)
    expect(DROP_MS).toBe(280)
    expect(respawnDropY(140)).toBeGreaterThan(DROP_H / 2) // easeIn：前半段落得慢
    expect(respawnDropY(DROP_MS)).toBe(0)
    expect(respawnDropY(-1)).toBe(0)
  })
})

describe('raceFx/fxModel — 甩尾火花（§8 #1）與噴焰色（§8 #2）', () => {
  it('段位 0..3：顏色白→藍→橘→紫、emitRate 20/40/55/70、size ×1/×1/×1.15/×1.3', () => {
    expect([0, 1, 2, 3].map((t) => driftSparkLook(t as 0 | 1 | 2 | 3).color)).toEqual([...DRIFT_COLORS])
    expect([0, 1, 2, 3].map((t) => driftSparkLook(t as 0 | 1 | 2 | 3).rate)).toEqual([20, 40, 55, 70])
    expect([0, 1, 2, 3].map((t) => driftSparkLook(t as 0 | 1 | 2 | 3).size)).toEqual([1, 1, 1.15, 1.3])
  })

  it('加速開始前剛有甩尾段位 → mini-turbo 段位色；否則（加速帶、加速菇）flame', () => {
    expect(boostColor(2)).toEqual({ kind: 'turbo', color: DRIFT_COLORS[2] })
    expect(boostColor(3)).toEqual({ kind: 'turbo', color: DRIFT_COLORS[3] })
    expect(boostColor(0).kind).toBe('flame')
  })
})

describe('raceFx/fxModel — 尾流風線（§8 #3）與速度線（§8 #4）', () => {
  it('蓄積中 2 條 alpha 0.35；生效 6 條 alpha 0.7；都沒有 0 條', () => {
    expect(slipLook(false, false)).toEqual({ count: 0, alpha: 0 })
    expect(slipLook(true, false)).toEqual({ count: 2, alpha: 0.35 })
    expect(slipLook(true, true)).toEqual({ count: 6, alpha: 0.7 })
    expect(slipLook(false, true)).toEqual({ count: 6, alpha: 0.7 })
  })

  it('速度線：90% 以下 0、滿速 0.6、加速中 0.6；上限依 reduced-motion 0.25／手機 0.35', () => {
    expect(speedLineAlpha(0.8, false, 1)).toBe(0)
    expect(speedLineAlpha(0.95, false, 1)).toBeCloseTo(0.3)
    expect(speedLineAlpha(1, false, 1)).toBeCloseTo(0.6)
    expect(speedLineAlpha(0.2, true, 1)).toBeCloseTo(0.6)
    expect(speedLineAlpha(1, true, speedLineCap({ reducedMotion: true, mobile: false }))).toBeCloseTo(0.25)
    expect(speedLineCap({ reducedMotion: false, mobile: true })).toBe(0.35)
    expect(speedLineCap({ reducedMotion: true, mobile: true })).toBe(0.25)
  })
})

describe('raceFx/fxModel — 胎痕（§8 #6）、碰撞火花（§8 #7）', () => {
  it('胎痕 2.5s：前段原尺寸、最後 0.6s 縮小、到期 null', () => {
    expect(skidScale(0)).toBe(1)
    expect(skidScale(1800)).toBe(1)
    expect(skidScale(2200)).toBeGreaterThan(0)
    expect(skidScale(2200)).toBeLessThan(1)
    expect(skidScale(2500)).toBeNull()
  })

  it('相對速度：同向同速 0、對撞相加', () => {
    expect(relSpeed({ speed: 10, ry: 0 }, { speed: 10, ry: 0 })).toBeCloseTo(0)
    expect(relSpeed({ speed: 5, ry: 0 }, { speed: 5, ry: Math.PI })).toBeCloseTo(10)
  })

  it('同一對 300ms 內不重播；pair key 與順序無關', () => {
    expect(CLASH_SPEED).toBe(4)
    expect(clashKey('b', 'a')).toBe(clashKey('a', 'b'))
    const last = new Map<string, number>()
    expect(clashReady(last, 'a|b', 1000)).toBe(true)
    expect(clashReady(last, 'a|b', 1000 + CLASH_COOLDOWN_MS - 1)).toBe(false)
    expect(clashReady(last, 'a|c', 1100)).toBe(true)
    expect(clashReady(last, 'a|b', 1000 + CLASH_COOLDOWN_MS)).toBe(true)
  })
})

describe('raceFx/fxModel — 道具箱碎裂與重生（§8 #8）', () => {
  it('碎塊：拋物線、縮小，450ms 後 null', () => {
    const a = chunkPose(0, 2, 5, 0)
    expect(a).toEqual({ x: 0, y: 0, z: 0, scale: 1 })
    const b = chunkPose(200, 2, 5, 0)!
    expect(b.x).toBeCloseTo(0.4)
    expect(b.y).toBeGreaterThan(0)
    expect(b.scale).toBeLessThan(1)
    expect(chunkPose(450, 2, 5, 0)).toBeNull()
  })

  it('重生：scale 0 → 1.1 → 1（backOut 300ms），之後 1', () => {
    expect(boxPopScale(0)).toBeCloseTo(0)
    let peak = 0
    for (let t = 0; t <= BOX_POP_MS; t += 10) peak = Math.max(peak, boxPopScale(t))
    expect(peak).toBeGreaterThan(1.05)
    expect(boxPopScale(BOX_POP_MS)).toBe(1)
    expect(boxPopScale(5000)).toBe(1)
  })
})

describe('raceFx/fxModel — 打滑（§6、§8 #9／#10）', () => {
  it('ms 內轉 2 圈（easeOut），結束為 0', () => {
    expect(spinPose(0, 800, false).yaw).toBe(0)
    expect(spinPose(400, 800, false).yaw).toBeGreaterThan(Math.PI * 2) // easeOut：一半時間轉過一半以上
    expect(spinPose(799, 800, false).yaw).toBeLessThan(Math.PI * 4)
    expect(spinPose(800, 800, false)).toEqual({ yaw: 0, lift: 0 })
  })

  it('龜殼命中另加前 400ms 彈起 0.8（sin），香蕉不彈', () => {
    expect(spinPose(200, 1200, true).lift).toBeCloseTo(0.8)
    expect(spinPose(500, 1200, true).lift).toBe(0)
    expect(spinPose(200, 800, false).lift).toBe(0)
  })

  it('被踩到的香蕉：原地彈起 0.6、轉 2 圈、300ms 縮小消失', () => {
    const mid = dyingBananaPose(150)!
    expect(mid.lift).toBeCloseTo(0.6)
    expect(mid.scale).toBeGreaterThan(0)
    expect(mid.scale).toBeLessThan(1)
    expect(dyingBananaPose(300)).toBeNull()
  })
})

describe('raceFx/fxModel — 護盾（§6、§8 #11）', () => {
  it('開著：scale 1；最後 2 秒 6Hz 閃（alpha 1／0.35）', () => {
    expect(shieldPose({ on: true, leftMs: 5000, offMs: 0, broke: false })).toEqual({ scale: 1, alpha: 1 })
    const alphas = new Set<number>()
    for (let left = 1999; left > 0; left -= 20) alphas.add(shieldPose({ on: true, leftMs: left, offMs: 0, broke: false })!.alpha)
    expect(alphas.size).toBe(2)
  })

  it('擋下：220ms scale 1→1.25、alpha→0；到期：300ms 淡出', () => {
    const b = shieldPose({ on: false, leftMs: null, offMs: 110, broke: true })!
    expect(b.scale).toBeCloseTo(1.125)
    expect(b.alpha).toBeCloseTo(0.5)
    expect(shieldPose({ on: false, leftMs: null, offMs: 220, broke: true })).toBeNull()
    const f = shieldPose({ on: false, leftMs: null, offMs: 150, broke: false })!
    expect(f.scale).toBe(1)
    expect(f.alpha).toBeCloseTo(0.5)
    expect(shieldPose({ on: false, leftMs: null, offMs: 300, broke: false })).toBeNull()
  })
})

describe('raceFx/fxModel — 落地、浮字、彩帶、鏡頭微震、加速菇', () => {
  it('落地擠壓 220ms（振幅 0.2）', () => {
    expect(LAND_MS).toBe(220)
    expect(landSquash(-1)).toEqual({ sy: 1, sxz: 1 })
    expect(landSquash(40).sy).toBeLessThan(1)
    expect(landSquash(LAND_MS)).toEqual({ sy: 1, sxz: 1 })
  })

  it('換圈字卡：彈出 220ms（0→1.15→1）、停 700ms、上飄淡出 300ms', () => {
    expect(lapCardPose(0)!.scale).toBeCloseTo(0)
    let peak = 0
    for (let t = 0; t <= 220; t += 5) peak = Math.max(peak, lapCardPose(t)!.scale)
    expect(peak).toBeGreaterThan(1.05)
    expect(lapCardPose(500)).toEqual({ scale: 1, rise: 0, alpha: 1 })
    const leave = lapCardPose(1070)!
    expect(leave.alpha).toBeCloseTo(0.5)
    expect(leave.rise).toBeGreaterThan(0)
    expect(lapCardPose(1220)).toBeNull()
  })

  it('衝線彩帶：自己 60 顆、他人 20 顆', () => {
    expect(finishConfetti(true)).toBe(60)
    expect(finishConfetti(false)).toBe(20)
  })

  it('鏡頭微震 220ms ±0.18 線性衰減；reduced-motion 或手機不震', () => {
    expect(SHAKE_MS).toBe(220)
    expect(SHAKE_AMP).toBe(0.18)
    expect(shakeAmp(0)).toBeCloseTo(0.18)
    expect(shakeAmp(110)).toBeCloseTo(0.09)
    expect(shakeAmp(220)).toBe(0)
    expect(shakeAmp(-5)).toBe(0)
    expect(shakeAllowed({ reducedMotion: false, mobile: false })).toBe(true)
    expect(shakeAllowed({ reducedMotion: true, mobile: false })).toBe(false)
    expect(shakeAllowed({ reducedMotion: false, mobile: true })).toBe(false)
  })

  it('加速菇：backOut 160ms 彈出、停 80ms、縮進 100ms，340ms 後 null', () => {
    expect(mushroomPose(0)!.scale).toBeCloseTo(0)
    expect(mushroomPose(200)).toEqual({ scale: 1, sink: 0 })
    const s = mushroomPose(290)!
    expect(s.sink).toBeGreaterThan(0)
    expect(mushroomPose(340)).toBeNull()
  })
})

describe('raceFx/fxModel — 衝線彩帶觸發（波 4 review I1）', () => {
  it('只在比賽中、fin 由 null 變數值時觸發', () => {
    const prev = new Map<string, number | null>()
    expect(finishEdges(prev, [{ id: 'a', fin: null }], true)).toEqual([])
    expect(finishEdges(prev, [{ id: 'a', fin: 90000 }], true)).toEqual(['a'])
    expect(finishEdges(prev, [{ id: 'a', fin: 90000 }], true)).toEqual([])
  })

  it('重開局：倒數期間讀到上一局的舊 fin 不觸發，進比賽後舊值仍在也不觸發', () => {
    const prev = new Map<string, number | null>() // resetRace 清空
    expect(finishEdges(prev, [{ id: 'g', fin: 95000 }], false)).toEqual([])
    expect(finishEdges(prev, [{ id: 'g', fin: 95000 }], true)).toEqual([])
    expect(finishEdges(prev, [{ id: 'g', fin: null }], true)).toEqual([])
    expect(finishEdges(prev, [{ id: 'g', fin: 70000 }], true)).toEqual(['g'])
  })

  it('比賽外過線不觸發，但記住狀態', () => {
    const prev = new Map<string, number | null>([['a', null]])
    expect(finishEdges(prev, [{ id: 'a', fin: 1000 }], false)).toEqual([])
    expect(finishEdges(prev, [{ id: 'a', fin: 1000 }], true)).toEqual([])
  })
})

describe('raceFx/fxModel — 甩尾火花可見度（波 4 qa BUG：紫段在深紫路面看不見）', () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  }
  it('出生色是段位色往白拉的亮芯（比段位色亮、仍保留色相：最大通道不變）', () => {
    for (const t of [1, 2, 3] as const) {
      const base = driftSparkLook(t).color
      const hot = sparkHot(base)
      expect(lum(hot)).toBeGreaterThan(lum(base) + 40)
      const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      const b = ch(base)
      const k = ch(hot)
      expect(k.indexOf(Math.max(...k))).toBe(b.indexOf(Math.max(...b)))
    }
    expect(sparkHot('#FFFFFF')).toBe('#FFFFFF')
  })

  it('火花基準尺寸放大到 0.45 以上（fx_spark 只有約 11% 面積不透明，ADD 混色在深色路面上才看得到）', () => {
    expect(SPARK_SIZE).toBeGreaterThanOrEqual(0.45)
  })
})
