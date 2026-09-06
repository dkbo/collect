import { describe, it, expect } from 'vitest'
import {
  SHOOT_COOLDOWN_TOLERANCE,
  validateShootReq,
  type ShootReqContext,
} from './tankNet'

/**
 * shootReq host 端裁決測試：合法請求原樣通過，
 * 已毀損 / 冷卻未到 / 起點與已知位置對不上 / 速度大小不對 一律靜默丟棄。
 */

const BULLET_SPEED = 12
const COOLDOWN_MS = 500
const NOW = 100_000

/** 標準情境：玩家存活、位於原點、從未開火 */
const ctx = (over: Partial<ShootReqContext> = {}): ShootReqContext => ({
  alive: true,
  lastShotAt: undefined,
  cooldownMs: COOLDOWN_MS,
  knownPos: { x: 0, z: 0 },
  now: NOW,
  worldLimit: 18,
  bulletSpeed: BULLET_SPEED,
  ...over,
})

/** 客端 requestFire 的算法：起點沿砲塔方向偏移 0.6，速度 = 方向 × BULLET_SPEED */
const shot = (angle = 0) => ({
  x: Math.sin(angle) * 0.6,
  z: Math.cos(angle) * 0.6,
  vx: Math.sin(angle) * BULLET_SPEED,
  vz: Math.cos(angle) * BULLET_SPEED,
})

describe('validateShootReq — 合法請求', () => {
  it('客端正常開火原樣通過', () => {
    const req = shot()
    expect(validateShootReq(req, ctx())).toEqual(req)
  })

  it('冷卻已過的第二發也通過', () => {
    expect(validateShootReq(shot(1.2), ctx({ lastShotAt: NOW - COOLDOWN_MS }))).not.toBeNull()
  })
})

describe('validateShootReq — 四種拒絕', () => {
  it('請求者已毀損', () => {
    expect(validateShootReq(shot(), ctx({ alive: false }))).toBeNull()
  })

  it('冷卻未到', () => {
    expect(validateShootReq(shot(), ctx({ lastShotAt: NOW - 100 }))).toBeNull()
  })

  it('起點離 host 已知位置太遠（傳送開火）', () => {
    const far = { ...shot(), x: 5, z: 5 }
    expect(validateShootReq(far, ctx())).toBeNull()
  })

  it('host 尚無該玩家位置樣本時一律拒絕', () => {
    expect(validateShootReq(shot(), ctx({ knownPos: null }))).toBeNull()
  })

  it('速度大小不是標準子彈速度（超速／龜速）', () => {
    expect(validateShootReq({ ...shot(), vx: 0, vz: BULLET_SPEED * 1.5 }, ctx())).toBeNull()
    expect(validateShootReq({ ...shot(), vx: 0, vz: BULLET_SPEED * 0.5 }, ctx())).toBeNull()
    expect(validateShootReq({ ...shot(), vx: 0, vz: 0 }, ctx())).toBeNull()
  })
})

describe('validateShootReq — 冷卻邊界', () => {
  const gate = COOLDOWN_MS * SHOOT_COOLDOWN_TOLERANCE // 400ms

  it('恰好達到 0.8× 冷卻即通過', () => {
    expect(validateShootReq(shot(), ctx({ lastShotAt: NOW - gate }))).not.toBeNull()
  })

  it('略小於 0.8× 冷卻即拒絕', () => {
    expect(validateShootReq(shot(), ctx({ lastShotAt: NOW - gate + 1 }))).toBeNull()
  })

  it('rapid 道具縮短冷卻後，間隔隨之縮短', () => {
    const rapid = ctx({ cooldownMs: COOLDOWN_MS * 0.5, lastShotAt: NOW - 200 })
    expect(validateShootReq(shot(), rapid)).not.toBeNull()
    expect(validateShootReq(shot(), { ...rapid, cooldownMs: COOLDOWN_MS })).toBeNull()
  })
})

describe('validateShootReq — payload 形狀', () => {
  it('非物件、缺欄位、非有限數、座標越界皆拒收', () => {
    expect(validateShootReq(null, ctx())).toBeNull()
    expect(validateShootReq('bang', ctx())).toBeNull()
    expect(validateShootReq({ x: 0, z: 0 }, ctx())).toBeNull()
    expect(validateShootReq({ ...shot(), vx: NaN }, ctx())).toBeNull()
    expect(validateShootReq({ ...shot(), x: 999 }, ctx())).toBeNull()
  })
})
