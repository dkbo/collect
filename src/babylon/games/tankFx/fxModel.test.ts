import { describe, expect, it } from 'vitest'
import {
  CARD_HOLD_MS,
  CARD_LEAVE_MS,
  CARD_POP_MS,
  EXPIRY_WARN_MS,
  FLASH_ALPHA,
  INVULN_DIM,
  SHAKE_AMP,
  SHAKE_MS,
  SHIELD_BREAK_MS,
  SHIELD_FADE_MS,
  STREAK_WINDOW_MS,
  beamPose,
  cardPose,
  distanceSteps,
  expiryBlinkOn,
  fireballPose,
  floatCellUV,
  floatLabelIndex,
  hitFlashAlpha,
  invulnVisibility,
  muzzlePose,
  shakeAllowed,
  shakeAmp,
  shieldPose,
  streakAfterKill,
  streakLabel,
  wreckColors,
} from '@/babylon/games/tankFx/fxModel'

const NOW = 80_000

describe('invulnVisibility（spec §6：10Hz、1↔0.35）', () => {
  it('無敵到期後恆為 1', () => {
    expect(invulnVisibility(NOW, NOW)).toBe(1)
    expect(invulnVisibility(NOW, 0)).toBe(1)
  })
  it('期間在 1 與 0.35 間切換，每 50ms 換一次', () => {
    const until = NOW + 1000
    expect(invulnVisibility(NOW, until)).toBe(1)
    expect(invulnVisibility(NOW + 60, until)).toBe(INVULN_DIM)
    expect(invulnVisibility(NOW + 110, until)).toBe(1)
  })
  it('各端以剩餘時間算相位：同一個剩餘量結果相同', () => {
    expect(invulnVisibility(1000, 1600)).toBe(invulnVisibility(5000, 5600))
  })
})

describe('hitFlashAlpha（spec §6：80ms 全白、120ms 淡出）', () => {
  it('開頭 80ms 維持 0.75', () => {
    expect(hitFlashAlpha(0)).toBe(FLASH_ALPHA)
    expect(hitFlashAlpha(79)).toBe(FLASH_ALPHA)
  })
  it('之後線性淡到 0，200ms 起為 0', () => {
    expect(hitFlashAlpha(140)).toBeCloseTo(FLASH_ALPHA / 2, 5)
    expect(hitFlashAlpha(200)).toBe(0)
    expect(hitFlashAlpha(-1)).toBe(0)
    expect(hitFlashAlpha(Infinity)).toBe(0)
  })
})

describe('鏡頭微震（spec §8 #17）', () => {
  it('振幅 0.25 線性衰減，180ms 後為 0', () => {
    expect(shakeAmp(0)).toBeCloseTo(SHAKE_AMP, 6)
    expect(shakeAmp(SHAKE_MS / 2)).toBeCloseTo(SHAKE_AMP / 2, 6)
    expect(shakeAmp(SHAKE_MS)).toBe(0)
    expect(shakeAmp(-5)).toBe(0)
  })
  it('prefers-reduced-motion 或手機檔不震', () => {
    expect(shakeAllowed({ reducedMotion: false, tier: 'desktop' })).toBe(true)
    expect(shakeAllowed({ reducedMotion: true, tier: 'desktop' })).toBe(false)
    expect(shakeAllowed({ reducedMotion: false, tier: 'mobile' })).toBe(false)
  })
})

describe('砲口焰／光柱／火球', () => {
  it('砲口焰 scale 0.5→1.0 後淡出，90ms 結束', () => {
    expect(muzzlePose(0)?.scale).toBeCloseTo(0.5, 6)
    expect(muzzlePose(45)?.scale).toBeCloseTo(1, 6)
    expect(muzzlePose(80)!.alpha).toBeLessThan(1)
    expect(muzzlePose(90)).toBeNull()
  })
  it('拾取光柱 120ms 長滿、再 280ms 淡出', () => {
    expect(beamPose(0)?.sy).toBe(0)
    expect(beamPose(120)?.sy).toBe(1)
    expect(beamPose(120)?.alpha).toBe(1)
    expect(beamPose(260)?.alpha).toBeCloseTo(0.5, 5)
    expect(beamPose(400)).toBeNull()
  })
  it('火球 scale 0.4→1.2、三層色依序、300ms 結束', () => {
    const a = fireballPose(0)!
    const b = fireballPose(299)!
    expect(a.scale).toBeCloseTo(0.4, 6)
    expect(b.scale).toBeCloseTo(1.2, 2)
    expect([a.stage, fireballPose(150)!.stage, b.stage]).toEqual([0, 1, 2])
    expect(fireballPose(300)).toBeNull()
  })
})

describe('護盾泡泡（spec §6、§8 #8）', () => {
  it('到期前 2 秒以 6Hz 閃，之前恆亮', () => {
    const until = NOW + 5000
    expect(expiryBlinkOn(NOW, until)).toBe(true)
    const states = new Set<boolean>()
    for (let t = until - EXPIRY_WARN_MS; t < until; t += 20) states.add(expiryBlinkOn(t, until))
    expect(states).toEqual(new Set([true, false]))
  })
  it('有效期間顯示、scale 1', () => {
    expect(shieldPose(NOW, NOW + 3000, -Infinity)).toEqual({ scale: 1, alpha: 1 })
  })
  it('被打破：220ms 內 scale 1→1.25、alpha→0，之後收起', () => {
    const p = shieldPose(NOW + 110, 0, NOW)!
    expect(p.scale).toBeGreaterThan(1)
    expect(p.scale).toBeLessThan(1.25)
    expect(p.alpha).toBeCloseTo(0.5, 5)
    expect(shieldPose(NOW + SHIELD_BREAK_MS, 0, NOW)).toBeNull()
  })
  it('自然到期：300ms 淡出後收起；從沒拿過不顯示', () => {
    expect(shieldPose(NOW + 150, NOW, -Infinity)?.alpha).toBeCloseTo(0.5, 5)
    expect(shieldPose(NOW + SHIELD_FADE_MS, NOW, -Infinity)).toBeNull()
    expect(shieldPose(NOW, 0, -Infinity)).toBeNull()
  })
})

describe('連殺（spec §8 #16）', () => {
  it('4 秒內再殺累加，超過重算', () => {
    const a = streakAfterKill(undefined, NOW)
    expect(a.count).toBe(1)
    const b = streakAfterKill(a, NOW + STREAK_WINDOW_MS)
    expect(b.count).toBe(2)
    expect(streakAfterKill(b, NOW + STREAK_WINDOW_MS + 3000).count).toBe(3)
    expect(streakAfterKill(b, NOW + STREAK_WINDOW_MS * 2 + 1).count).toBe(1)
  })
  it('2 殺「雙殺」、3 殺以上「三殺」、1 殺不顯示', () => {
    expect(streakLabel(1)).toBeNull()
    expect(streakLabel(2)).toBe('雙殺')
    expect(streakLabel(3)).toBe('三殺')
    expect(streakLabel(4)).toBe('三殺')
  })
  it('字卡：彈出到 1.25 再回 1、停留、上飄淡出', () => {
    expect(cardPose(0)!.scale).toBe(0)
    const peak = Math.max(...Array.from({ length: 27 }, (_, i) => cardPose(i * 10)!.scale))
    expect(peak).toBeCloseTo(1.25, 2)
    expect(cardPose(CARD_POP_MS + 10)).toEqual({ scale: 1, rise: 0, alpha: 1 })
    const leave = cardPose(CARD_POP_MS + CARD_HOLD_MS + CARD_LEAVE_MS / 2)!
    expect(leave.alpha).toBeCloseTo(0.5, 5)
    expect(leave.rise).toBeGreaterThan(0)
    expect(cardPose(CARD_POP_MS + CARD_HOLD_MS + CARD_LEAVE_MS)).toBeNull()
  })
})

describe('浮字圖集（spec §8.1：512×256、8 格 128×64）', () => {
  it('拾取浮字與連殺字卡各對到固定格', () => {
    expect(['hp', 'speed', 'rapid', 'shield', 'triple'].map((k) => floatLabelIndex(k))).toEqual([0, 1, 2, 3, 4])
    expect(floatLabelIndex('雙殺')).toBe(5)
    expect(floatLabelIndex('三殺')).toBe(6)
  })
  it('格 UV：4 欄 4 列，canvas 上方是 v 大的一側', () => {
    expect(floatCellUV(0)).toEqual([0, 0.75, 0.25, 1])
    expect(floatCellUV(5)).toEqual([0.25, 0.5, 0.5, 0.75])
  })
})

describe('distanceSteps（履帶痕每 0.42、揚塵每 0.5）', () => {
  it('累積距離到間隔才出一筆，餘數留到下次', () => {
    const a = distanceSteps(0, 0.3, 0.42)
    expect(a.count).toBe(0)
    const b = distanceSteps(a.acc, 0.6, 0.42)
    expect(b.count).toBe(2)
    expect(b.acc).toBeCloseTo(0.06, 6)
  })
  it('單次位移過大（瞬移）不出痕', () => {
    expect(distanceSteps(0, 5, 0.42).count).toBe(0)
  })
})

describe('wreckColors（殘骸灰階換成 wreck 三色）', () => {
  it('亮的頂點對到 light、暗的對到 dark，alpha 不變', () => {
    const out = wreckColors([1, 1, 1, 1, 0, 0, 0, 0.5])
    expect(Array.from(out.slice(0, 4)).map((v) => +v.toFixed(3))).toEqual([0.431, 0.408, 0.565, 1])
    expect(Array.from(out.slice(4, 8)).map((v) => +v.toFixed(3))).toEqual([0.169, 0.141, 0.251, 0.5])
  })
  it('長度與輸入相同', () => {
    expect(wreckColors(new Float32Array(12)).length).toBe(12)
  })
})
