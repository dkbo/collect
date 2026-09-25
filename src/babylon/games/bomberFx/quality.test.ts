import { describe, expect, it } from 'vitest'
import { FpsWatch, nextDegrade, noDegradeFlag, pickTier, tierSettings } from '@/babylon/games/bomberFx/quality'

describe('pickTier', () => {
  it('桌機：非觸控且核心數 > 4', () => {
    expect(pickTier({ search: '', touch: false, cores: 8 })).toBe('desktop')
  })

  it('觸控或核心數 <= 4 走 mobile', () => {
    expect(pickTier({ search: '', touch: true, cores: 16 })).toBe('mobile')
    expect(pickTier({ search: '', touch: false, cores: 4 })).toBe('mobile')
  })

  it('取不到核心數時不因此降級', () => {
    expect(pickTier({ search: '', touch: false, cores: undefined })).toBe('desktop')
  })

  it('?bomberTier= 強制檔位，無效值忽略', () => {
    expect(pickTier({ search: '?bomberTier=desktop', touch: true, cores: 2 })).toBe('desktop')
    expect(pickTier({ search: '?x=1&bomberTier=mobile', touch: false, cores: 16 })).toBe('mobile')
    expect(pickTier({ search: '?bomberTier=ultra', touch: false, cores: 16 })).toBe('desktop')
  })
})

describe('noDegradeFlag', () => {
  it('只有 bomberNoDegrade=1 才關自動降級', () => {
    expect(noDegradeFlag('?bomberNoDegrade=1')).toBe(true)
    expect(noDegradeFlag('?bomberTier=desktop&bomberNoDegrade=1')).toBe(true)
    expect(noDegradeFlag('?bomberNoDegrade=0')).toBe(false)
    expect(noDegradeFlag('')).toBe(false)
  })
})

describe('tierSettings', () => {
  it('桌機：全開，解析度 1/min(dpr,2)', () => {
    const s = tierSettings('desktop', 3)
    expect(s).toMatchObject({ outline: true, glow: true, bloom: true, shadowSize: 1024, particleCap: 150 })
    expect(s.hardwareScaling).toBeCloseTo(0.5)
    expect(tierSettings('desktop', 1.5).hardwareScaling).toBeCloseTo(1 / 1.5)
    expect(tierSettings('desktop', 1).hardwareScaling).toBe(1)
  })

  it('手機：關描邊／Glow／bloom，陰影 512，粒子 60，解析度固定 1.5', () => {
    expect(tierSettings('mobile', 3)).toEqual({
      outline: false,
      glow: false,
      bloom: false,
      shadowSize: 512,
      particleCap: 60,
      hardwareScaling: 1.5,
    })
  })
})

describe('nextDegrade', () => {
  it('依序 描邊 → Glow → 陰影，已關的跳過', () => {
    expect(nextDegrade({ outline: true, glow: true, shadow: true })).toBe('outline')
    expect(nextDegrade({ outline: false, glow: true, shadow: true })).toBe('glow')
    expect(nextDegrade({ outline: false, glow: false, shadow: true })).toBe('shadow')
    expect(nextDegrade({ outline: false, glow: false, shadow: false })).toBeNull()
  })
})

describe('FpsWatch', () => {
  const feed = (w: FpsWatch, ms: number, n: number): boolean[] => Array.from({ length: n }, () => w.push(ms))

  it('連續 60 幀平均低於 45fps 才觸發一次', () => {
    const w = new FpsWatch({ warmup: 0 })
    const r = feed(w, 1000 / 40, 60)
    expect(r.slice(0, 59).some(Boolean)).toBe(false)
    expect(r[59]).toBe(true)
  })

  it('平均不低於 45fps 不觸發', () => {
    const w = new FpsWatch({ warmup: 0 })
    expect(feed(w, 1000 / 50, 180).some(Boolean)).toBe(false)
  })

  it('觸發後重新累積下一個 60 幀視窗', () => {
    const w = new FpsWatch({ warmup: 0 })
    feed(w, 1000 / 30, 60)
    const r = feed(w, 1000 / 30, 60)
    expect(r.filter(Boolean)).toHaveLength(1)
    expect(r[59]).toBe(true)
  })

  it('暖機幀不計入', () => {
    const w = new FpsWatch({ warmup: 30 })
    const r = feed(w, 1000 / 20, 89)
    expect(r.some(Boolean)).toBe(false)
    expect(w.push(1000 / 20)).toBe(true)
  })

  it('單幀超過 maxGapMs（切分頁／卡頓）視為暫停，清空視窗重來', () => {
    const w = new FpsWatch({ warmup: 0, maxGapMs: 500 })
    feed(w, 1000 / 60, 59)
    expect(w.push(3000)).toBe(false)
    expect(feed(w, 1000 / 60, 60).some(Boolean)).toBe(false)
  })
})
