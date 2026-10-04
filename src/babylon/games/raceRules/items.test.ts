import { describe, it, expect } from 'vitest'
import {
  BANANA_ARM_MS,
  BOXES_PER_ROW,
  ITEM_KINDS,
  ITEM_RESPAWN_MS,
  MUSHROOM_MS,
  SHELL_LIFE_MS,
  SHELL_SPIN_MS,
  SHIELD_MS,
  SPIN_MS,
  BANANA_MAX,
  SHELL_RADIUS,
  SHELL_SPEED,
  SHELL_TURN,
  applySpin,
  bananaOverflow,
  rollTier,
  shellBananaClash,
  boxLayout,
  claimBox,
  rollItem,
  shellGone,
  shellTarget,
  hitTest,
  spawnItem,
  stepShell,
  takenBoxes,
  touchedBox,
  useItemSelf,
  type HitCar,
  type ItemKind,
  type Shell,
} from '@/babylon/games/raceRules/items'
import { makeRacer } from '@/babylon/games/raceRules/drive'
import { makeCourse, pointAt, trackProgress, type Vec2 } from '@/babylon/games/raceRules/track'

const CTRL: Vec2[] = (
  [
    [20, 0], [30, 0], [40, 0], [40, 10], [40, 20], [40, 30], [40, 40], [30, 40],
    [20, 40], [10, 40], [0, 40], [0, 30], [0, 20], [0, 10], [0, 0], [10, 0],
  ] as Vec2[]
).map(([x, z]) => [x - 20, z - 20] as Vec2)
const course = makeCourse({ ctrl: CTRL, width: 8, bound: { x: 40, z: 40 }, pads: [], jumps: [], itemRows: [16, 96] })
const track = course.track

describe('道具箱：先到先得、重生、手上最多 1 個', () => {
  const boxes = boxLayout(course)
  const fresh = boxes.map(() => 0)

  it(`每列 ${BOXES_PER_ROW} 個、id 依序、都在路面內且同列沿線距離相同`, () => {
    expect(boxes).toHaveLength(course.itemRows.length * BOXES_PER_ROW)
    expect(boxes.map((b) => b.id)).toEqual(boxes.map((_, i) => i))
    for (const b of boxes) {
      const p = trackProgress(track, b.x, b.z)
      expect(Math.abs(p.lateral)).toBeLessThan(track.width / 2)
      expect(p.s).toBeCloseTo(course.itemRows[Math.floor(b.id / BOXES_PER_ROW)], 3)
    }
  })

  it('同一箱兩人搶：先到的拿到、後到的不給', () => {
    const a = claimBox(fresh, 1, null, 1000)
    expect(a.ok).toBe(true)
    const b = claimBox(a.respawnAt, 1, null, 1000)
    expect(b.ok).toBe(false)
    expect(b.respawnAt).toEqual(a.respawnAt)
  })

  it(`被撿走 ${ITEM_RESPAWN_MS}ms 後重生`, () => {
    const a = claimBox(fresh, 2, null, 1000)
    expect(takenBoxes(a.respawnAt, 1000 + ITEM_RESPAWN_MS - 1)).toEqual([2])
    expect(takenBoxes(a.respawnAt, 1000 + ITEM_RESPAWN_MS)).toEqual([])
    expect(claimBox(a.respawnAt, 2, null, 1000 + ITEM_RESPAWN_MS).ok).toBe(true)
  })

  it('手上已有道具不再給，箱子留著給後面的人', () => {
    const r = claimBox(fresh, 0, 'banana', 1000)
    expect(r.ok).toBe(false)
    expect(takenBoxes(r.respawnAt, 1000)).toEqual([])
  })

  it('不存在的箱 id 不給', () => {
    expect(claimBox(fresh, 99, null, 0).ok).toBe(false)
    expect(claimBox(fresh, -1, null, 0).ok).toBe(false)
  })

  it('touchedBox：碰到未被撿走的箱回 id，被撿走的略過', () => {
    const b = boxes[5]
    expect(touchedBox(boxes, [], b.x + 0.5, b.z)).toBe(5)
    expect(touchedBox(boxes, [5], b.x + 0.5, b.z)).toBeNull()
    expect(touchedBox(boxes, [], b.x + 5, b.z + 5)).toBeNull()
  })
})

describe('rollItem — 落後補償', () => {
  /** 以均勻細格積分 r ∈ [0,1) 得到各道具機率 */
  const odds = (rank: number, total: number) => {
    const n = 10000
    const c: Record<ItemKind, number> = { banana: 0, shell: 0, mushroom: 0, shield: 0 }
    for (let i = 0; i < n; i++) c[rollItem(rank, total, (i + 0.5) / n)]++
    return { ...c, strong: (c.mushroom + c.shell) / n }
  }

  it('第 1 名只會抽到香蕉或護盾', () => {
    for (let total = 1; total <= 8; total++) expect(odds(1, total).strong).toBe(0)
  })

  it('最後一名 P(加速菇∪龜殼) ≥ 0.6', () => {
    for (let total = 2; total <= 8; total++) expect(odds(total, total).strong).toBeGreaterThanOrEqual(0.6)
  })

  it('P(加速菇∪龜殼) 隨名次 1..total 非遞減', () => {
    for (let total = 2; total <= 8; total++) {
      const ps = Array.from({ length: total }, (_, i) => odds(i + 1, total).strong)
      for (let i = 1; i < total; i++) expect(ps[i]).toBeGreaterThanOrEqual(ps[i - 1])
    }
  })

  it('spec §2.1 名次分檔：4 台 1st→0、2nd→1、3rd→2、4th→3；3 台 2nd→1；2 台 2nd→3', () => {
    expect(rollTier(1, 4)).toBe(0)
    expect(rollTier(2, 4)).toBe(1)
    expect(rollTier(3, 4)).toBe(2)
    expect(rollTier(4, 4)).toBe(3)
    expect(rollTier(2, 3)).toBe(1)
    expect(rollTier(2, 2)).toBe(3)
    expect(rollTier(1, 1)).toBe(0)
  })

  it('依 banana→shell→mushroom→shield 累加：檔 0 的 r=0.59 → banana、r=0.6 → shield', () => {
    expect(rollItem(1, 4, 0.59)).toBe('banana')
    expect(rollItem(1, 4, 0.6)).toBe('shield')
    expect(rollItem(4, 4, 0.1)).toBe('shell')
    expect(rollItem(4, 4, 0.5)).toBe('mushroom')
    expect(rollItem(4, 4, 0.95)).toBe('shield')
  })

  it('r 在 [0,1) 任何值都回合法道具；越界的 r 與名次被夾住', () => {
    for (const r of [0, 0.25, 0.999999, 1, -1, NaN]) expect(ITEM_KINDS).toContain(rollItem(2, 4, r))
    expect(ITEM_KINDS).toContain(rollItem(0, 4, 0.5))
    expect(ITEM_KINDS).toContain(rollItem(9, 4, 0.5))
  })
})

describe('shellTarget — 紅龜殼目標', () => {
  const order = ['a', 'b', 'c', 'd']

  it('鎖定名次在自己前一名的車', () => {
    expect(shellTarget('c', order)).toBe('b')
    expect(shellTarget('d', order)).toBe('c')
  })

  it('自己第一名 → null（直線前射）', () => {
    expect(shellTarget('a', order)).toBeNull()
  })

  it('跳過已過線等不可鎖定的車，往更前面找', () => {
    expect(shellTarget('c', order, new Set(['b']))).toBe('a')
    expect(shellTarget('c', order, new Set(['a', 'b']))).toBeNull()
  })

  it('不在名單內 → null', () => {
    expect(shellTarget('x', order)).toBeNull()
  })
})

describe('hitTest — 命中判定與護盾', () => {
  const car = (id: string, x: number, z: number, o: Partial<HitCar> = {}): HitCar => ({ id, x, z, ghost: false, shield: false, ...o })

  it('香蕉碰到車：打滑 SPIN_MS', () => {
    expect(hitTest({ kind: 'banana', owner: 'a', x: 0, z: 0, ageMs: 5000 }, [car('b', 0.5, 0)])).toEqual({
      target: 'b',
      ms: SPIN_MS,
      blocked: false,
    })
  })

  it('龜殼命中：打滑 SPIN_MS × 1.5', () => {
    expect(SHELL_SPIN_MS).toBe(SPIN_MS * 1.5)
    expect(hitTest({ kind: 'shell', owner: 'a', x: 0, z: 0, ageMs: 100 }, [car('b', 0.5, 0)])?.ms).toBe(SHELL_SPIN_MS)
  })

  it('護盾擋下：blocked、ms = 0', () => {
    expect(hitTest({ kind: 'shell', owner: 'a', x: 0, z: 0, ageMs: 100 }, [car('b', 0.3, 0, { shield: true })])).toEqual({
      target: 'b',
      ms: 0,
      blocked: true,
    })
  })

  it('重生閃爍（ghost）中不被命中', () => {
    expect(hitTest({ kind: 'banana', owner: 'a', x: 0, z: 0, ageMs: 5000 }, [car('b', 0.3, 0, { ghost: true })])).toBeNull()
  })

  it('龜殼不打自己；香蕉剛丟出的 BANANA_ARM_MS 內不打自己，之後會', () => {
    expect(hitTest({ kind: 'shell', owner: 'a', x: 0, z: 0, ageMs: 3000 }, [car('a', 0.2, 0)])).toBeNull()
    expect(hitTest({ kind: 'banana', owner: 'a', x: 0, z: 0, ageMs: BANANA_ARM_MS - 1 }, [car('a', 0.2, 0)])).toBeNull()
    expect(hitTest({ kind: 'banana', owner: 'a', x: 0, z: 0, ageMs: BANANA_ARM_MS }, [car('a', 0.2, 0)])?.target).toBe('a')
  })

  it('同時碰到多台取最近；距離太遠不中', () => {
    const it = { kind: 'banana' as const, owner: 'z', x: 0, z: 0, ageMs: 5000 }
    expect(hitTest(it, [car('far', 0.9, 0), car('near', 0.2, 0)])?.target).toBe('near')
    expect(hitTest(it, [car('b', 3, 0)])).toBeNull()
  })

  it('追蹤中的龜殼只撞目標，路上其他車不受影響', () => {
    const sh = { kind: 'shell' as const, owner: 'a', target: 'c', x: 0, z: 0, ageMs: 100 }
    expect(hitTest(sh, [car('b', 0.2, 0)])).toBeNull()
    expect(hitTest(sh, [car('b', 0.2, 0), car('c', 0.5, 0)])?.target).toBe('c')
  })

  it('等距時依 id 決定（各端一致）', () => {
    const it = { kind: 'banana' as const, owner: 'z', x: 0, z: 0, ageMs: 5000 }
    expect(hitTest(it, [car('c', 0.5, 0), car('b', -0.5, 0)])?.target).toBe('b')
  })
})

describe('spawnItem／stepShell — 生成與龜殼移動', () => {
  it('香蕉丟在車後、靜止；龜殼在車前、沿車頭方向飛', () => {
    const b = spawnItem('banana', { x: 0, z: 0, ry: 0 })
    expect(b.z).toBeLessThan(0)
    expect(b.vx).toBe(0)
    expect(b.vz).toBe(0)
    const s = spawnItem('shell', { x: 0, z: 0, ry: Math.PI / 2 })
    expect(s.x).toBeGreaterThan(0)
    expect(s.vx).toBeGreaterThan(0)
    expect(s.vz).toBeCloseTo(0, 9)
  })

  const shellAt = (s: number, target: string | null): Shell => {
    const p = pointAt(track, s)
    const v = spawnItem('shell', { x: p.x, z: p.z, ry: p.heading })
    return { id: 'sh', owner: 'a', target, ageMs: 0, x: p.x, z: p.z, vx: v.vx, vz: v.vz }
  }

  it('無目標：直線前進', () => {
    let sh = shellAt(2, null)
    for (let i = 0; i < 10; i++) sh = stepShell(sh, null, track, 1 / 30)
    expect(sh.z).toBeCloseTo(pointAt(track, 2).z, 6)
    expect(sh.x).toBeGreaterThan(pointAt(track, 2).x)
    expect(sh.ageMs).toBeCloseTo(1000 / 3, 6)
  })

  it('有目標：沿賽道過彎（不切出路面），最後追上目標', () => {
    const tgt = pointAt(track, 60) // 過第一個彎之後
    let sh = shellAt(2, 'b')
    let minD = Infinity
    for (let i = 0; i < 120 && minD >= SHELL_RADIUS; i++) {
      sh = stepShell(sh, { x: tgt.x, z: tgt.z }, track, 1 / 30)
      expect(Math.abs(trackProgress(track, sh.x, sh.z).lateral)).toBeLessThan(track.width / 2)
      minD = Math.min(minD, Math.hypot(sh.x - tgt.x, sh.z - tgt.z))
    }
    expect(minD).toBeLessThan(SHELL_RADIUS)
  })

  it('沿線模式：偏離中心線的龜殼以每秒 4 單位收斂回 lateral 0', () => {
    const p = pointAt(track, 2)
    let sh: Shell = { ...shellAt(2, 'b'), z: p.z - 3 } // 朝 +x，右側 = −z → lateral +3
    const far = pointAt(track, 120)
    sh = stepShell(sh, { x: far.x, z: far.z }, track, 0.25)
    expect(trackProgress(track, sh.x, sh.z).lateral).toBeCloseTo(2, 1)
    sh = stepShell(sh, { x: far.x, z: far.z }, track, 0.5)
    expect(Math.abs(trackProgress(track, sh.x, sh.z).lateral)).toBeLessThan(0.05)
  })

  it(`近距離直接追：轉向速度上限 ${SHELL_TURN} rad/s`, () => {
    const sh: Shell = { id: 'sh', owner: 'a', target: 'b', ageMs: 0, x: 0, z: 0, vx: 0, vz: SHELL_SPEED } // 朝 +z
    const next = stepShell(sh, { x: 5, z: 0 }, track, 0.1) // 目標在正右方 90°
    const turned = Math.atan2(next.vx, next.vz)
    expect(turned).toBeCloseTo(SHELL_TURN * 0.1, 6)
    expect(Math.hypot(next.vx, next.vz)).toBeCloseTo(SHELL_SPEED, 6)
  })

  it(`壽命 ${SHELL_LIFE_MS}ms 或出界即消失；直射的離開路緣外 0.5 也消失`, () => {
    const sh = shellAt(2, null)
    expect(shellGone({ ...sh, ageMs: SHELL_LIFE_MS - 1 }, course)).toBe(false)
    expect(shellGone({ ...sh, ageMs: SHELL_LIFE_MS }, course)).toBe(true)
    expect(shellGone({ ...sh, x: 41 }, course)).toBe(true)
    const edge = track.width / 2 + 0.5
    expect(shellGone({ ...sh, z: sh.z - edge + 0.1 }, course)).toBe(false)
    expect(shellGone({ ...sh, z: sh.z - edge - 0.1 }, course)).toBe(true)
    expect(shellGone({ ...sh, target: 'b', z: sh.z - edge - 0.1 }, course)).toBe(false)
  })

  it('龜殼撞到香蕉：回傳那根香蕉（兩者都消失）', () => {
    const sh = shellAt(2, 'b')
    expect(shellBananaClash(sh, [{ id: 'n1', x: sh.x + 5, z: sh.z }, { id: 'n2', x: sh.x + 1, z: sh.z }])).toBe('n2')
    expect(shellBananaClash(sh, [{ id: 'n1', x: sh.x + 5, z: sh.z }])).toBeNull()
  })

  it(`香蕉上限 ${BANANA_MAX} 根：超過時回傳最舊的那些`, () => {
    const ids = Array.from({ length: BANANA_MAX + 2 }, (_, i) => `b${i}`)
    expect(bananaOverflow(ids)).toEqual(['b0', 'b1'])
    expect(bananaOverflow(ids.slice(0, BANANA_MAX))).toEqual([])
  })
})

describe('applySpin／useItemSelf — 套到自己的車', () => {
  const r0 = makeRacer(course, 0)

  it('被命中：spinMs 取大值、甩尾蓄力與加速清掉', () => {
    const r = applySpin({ ...r0, spinMs: 100, boostMs: 900, drift: { charge: 1, tier: 1 } }, SPIN_MS, false)
    expect(r.spinMs).toBe(SPIN_MS)
    expect(r.boostMs).toBe(0)
    expect(r.drift).toEqual({ charge: 0, tier: 0 })
  })

  it('護盾擋下：只消耗護盾，不打滑', () => {
    const r = applySpin({ ...r0, shieldMs: 5000 }, 0, true)
    expect(r.shieldMs).toBe(0)
    expect(r.spinMs).toBe(0)
  })

  it('加速菇給 MINI_TURBO_MS[1]、護盾給 SHIELD_MS；香蕉／龜殼不改自己', () => {
    expect(useItemSelf(r0, 'mushroom').boostMs).toBe(MUSHROOM_MS)
    expect(useItemSelf(r0, 'shield').shieldMs).toBe(SHIELD_MS)
    expect(useItemSelf(r0, 'banana')).toBe(r0)
    expect(useItemSelf(r0, 'shell')).toBe(r0)
  })
})
