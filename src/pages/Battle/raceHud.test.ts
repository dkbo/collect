import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GameHud, KitchenHud, RaceHud, TankHud } from '@/babylon/types'
import { sameHud } from '@/pages/Battle/bomberHud'
import { isKitchenHud } from '@/pages/Battle/kitchenHud'
import { isTankHud } from '@/pages/Battle/tankHud'
import {
  RACE_COLORS,
  RACE_ITEM_REEL,
  RACE_TOUCH_ACTIONS,
  RANK_TONES,
  bestLapImproved,
  formatLapMs,
  isRaceBotId,
  isRaceHud,
  itemSlotView,
  mapTransform,
  mapView,
  ordinal,
  ordinalSuffix,
  rankTone,
  resultRows,
  startTick,
} from '@/pages/Battle/raceHud'
import { RaceHudView } from '@/pages/Battle/RaceHud'

/** 方形測試賽道（逆時針），x 0..100、z 0..50 */
const PTS: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 50],
  [0, 50],
]

/** 假資料（照 RaceHud 共用契約）：第 2 圈、自己第 4、手上加速菇、3 台 bot */
function race(extra: Partial<RaceHud> = {}): RaceHud {
  return {
    kind: 'race',
    rank: 4,
    total: 4,
    lap: 2,
    laps: 3,
    lapMs: 18420,
    bestLapMs: 41070,
    item: 'mushroom',
    rolling: false,
    wrongWay: false,
    finalLap: false,
    finished: false,
    map: {
      pts: PTS,
      cars: [
        { id: 'me', colorIndex: 0, x: 90, z: 10, isSelf: true },
        { id: 'bot-0', colorIndex: 1, x: 95, z: 20, isSelf: false },
        { id: 'bot-1', colorIndex: 2, x: 50, z: 50, isSelf: false },
        { id: 'bot-2', colorIndex: 3, x: 0, z: 25, isSelf: false },
      ],
    },
    results: [],
    ...extra,
  }
}

const RESULTS: RaceHud['results'] = [
  { id: 'bot-1', name: '電腦2', colorIndex: 2, rank: 2, totalMs: 131250, bestLapMs: 42100 },
  { id: 'me', name: '小紅', colorIndex: 0, rank: 1, totalMs: 128400, bestLapMs: 41070 },
  { id: 'bot-2', name: '電腦3', colorIndex: 3, rank: 4, totalMs: null, bestLapMs: 44800 },
  { id: 'bot-0', name: '電腦1', colorIndex: 1, rank: 3, totalMs: 133900, bestLapMs: null },
]

describe('isRaceHud：setHud 依 kind 分流', () => {
  it('race 才是 race；其他三款不是', () => {
    const bomber: GameHud = { timer: { secondsLeft: 60, suddenDeath: false }, aliveCount: 1, totalCount: 1, players: [] }
    const kitchen = { kind: 'kitchen' } as KitchenHud
    const tank = { kind: 'tank' } as TankHud
    expect(isRaceHud(race())).toBe(true)
    expect(isRaceHud(null)).toBe(false)
    expect(isRaceHud(bomber)).toBe(false)
    expect(isRaceHud(kitchen)).toBe(false)
    expect(isRaceHud(tank)).toBe(false)
  })

  it('race 不會被當成 kitchen／tank', () => {
    expect(isKitchenHud(race())).toBe(false)
    expect(isTankHud(race())).toBe(false)
  })

  it('內容相同視為同一張 HUD（每幀 setHud 不重繪）', () => {
    expect(sameHud<RaceHud>(race(), race())).toBe(true)
    expect(sameHud<RaceHud>(race(), race({ lapMs: 18430 }))).toBe(false)
  })
})

describe('名次字尾 ordinal', () => {
  it('1st／2nd／3rd／4th', () => {
    expect([1, 2, 3, 4].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th'])
  })

  it('11–13 一律 th，21／22／23 回到 st／nd／rd', () => {
    expect([11, 12, 13].map(ordinalSuffix)).toEqual(['th', 'th', 'th'])
    expect([21, 22, 23, 101, 111].map(ordinal)).toEqual(['21st', '22nd', '23rd', '101st', '111th'])
  })

  it('非正整數夾成 1', () => {
    expect(ordinal(0)).toBe('1st')
    expect(ordinal(Number.NaN)).toBe('1st')
    expect(ordinal(2.4)).toBe('2nd')
  })
})

describe('圈時 formatLapMs → m:ss.cc', () => {
  it('一般值', () => {
    expect(formatLapMs(18420)).toBe('0:18.42')
    expect(formatLapMs(41070)).toBe('0:41.07')
    expect(formatLapMs(128400)).toBe('2:08.40')
    expect(formatLapMs(0)).toBe('0:00.00')
  })

  it('不足 10ms 的部分捨去（不進位成下一秒）', () => {
    expect(formatLapMs(59999)).toBe('0:59.99')
    expect(formatLapMs(60000)).toBe('1:00.00')
  })

  it('null、負數、非數字 → -:--.--', () => {
    expect(formatLapMs(null)).toBe('-:--.--')
    expect(formatLapMs(-1)).toBe('-:--.--')
    expect(formatLapMs(Number.NaN)).toBe('-:--.--')
    expect(formatLapMs(Number.POSITIVE_INFINITY)).toBe('-:--.--')
  })
})

describe('名次色 rankTone／RANK_TONES（spec §9.5）', () => {
  it('1 金、2 銀、3 銅、4 以後 plain', () => {
    expect([1, 2, 3, 4, 5].map(rankTone)).toEqual(['gold', 'silver', 'bronze', 'plain', 'plain'])
  })

  it('填色照 spec', () => {
    expect(RANK_TONES).toEqual({ gold: '#FFC21A', silver: '#E3E6EF', bronze: '#FF9A5A', plain: '#C9BEDB' })
  })
})

describe('小地圖 mapTransform（等比塞進、z 往上）', () => {
  it('寬賽道貼齊左右 pad、垂直置中；z 越大 py 越小', () => {
    const tf = mapTransform(PTS, 120, 100, 10)
    // 可用 100×80，賽道 100×50 → 比例 1，垂直餘 30 → 上下各 15
    expect(tf(0, 0)).toEqual([10, 75])
    expect(tf(100, 0)).toEqual([110, 75])
    expect(tf(0, 50)).toEqual([10, 25])
    expect(tf(100, 50)[1]).toBeLessThan(tf(100, 0)[1])
  })

  it('高賽道貼齊上下、水平置中', () => {
    const tall: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 40],
      [0, 40],
    ]
    const tf = mapTransform(tall, 100, 100, 10)
    expect(tf(0, 0)).toEqual([40, 90])
    expect(tf(10, 40)).toEqual([60, 10])
  })

  it('空陣列或單點不會除以 0', () => {
    const [x, y] = mapTransform([], 100, 80, 8)(3, 4)
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    expect(mapTransform([[5, 5]], 100, 80, 8)(5, 5)).toEqual([50, 40])
  })
})

describe('小地圖 mapView', () => {
  it('賽道折線首尾閉合', () => {
    const v = mapView(race().map)
    const pts = v.track.split(' ')
    expect(pts).toHaveLength(PTS.length + 1)
    expect(pts[0]).toBe(pts[pts.length - 1])
  })

  it('自己畫在最上層（排最後）且較大', () => {
    const v = mapView(race().map)
    expect(v.cars).toHaveLength(4)
    expect(v.cars[v.cars.length - 1].id).toBe('me')
    expect(v.cars[v.cars.length - 1].r).toBeGreaterThan(v.cars[0].r)
    expect(v.cars[0].fill).toBe(RACE_COLORS[1].base)
  })

  it('起跑線短橫垂直於第一段', () => {
    const t = startTick(PTS, mapTransform(PTS, 120, 100, 10), 4)
    // 第一段沿 +x → 短橫是垂直線（x 相同、y 差 8）
    expect(t.x1).toBeCloseTo(t.x2)
    expect(Math.abs(t.y1 - t.y2)).toBeCloseTo(8)
  })
})

describe('道具欄狀態 itemSlotView', () => {
  it('轉盤中一律 rolling；落定後有道具 item、沒有 empty', () => {
    expect(itemSlotView(null, true)).toBe('rolling')
    expect(itemSlotView('shell', true)).toBe('rolling')
    expect(itemSlotView('shell', false)).toBe('item')
    expect(itemSlotView(null, false)).toBe('empty')
  })

  it('轉盤膠卷依序 4 種道具', () => {
    expect(RACE_ITEM_REEL).toEqual(['banana', 'shell', 'mushroom', 'shield'])
  })
})

describe('最佳圈刷新 bestLapImproved', () => {
  it('第一次有最佳圈或變快才算', () => {
    expect(bestLapImproved(null, 41070)).toBe(true)
    expect(bestLapImproved(41070, 40000)).toBe(true)
    expect(bestLapImproved(41070, 41070)).toBe(false)
    expect(bestLapImproved(41070, null)).toBe(false)
    expect(bestLapImproved(null, null)).toBe(false)
  })
})

describe('衝線名次表 resultRows', () => {
  it('依名次排序、自己標 isSelf、bot 依 id 判定', () => {
    const rows = resultRows(RESULTS, 'me')
    expect(rows.map((r) => r.id)).toEqual(['me', 'bot-1', 'bot-0', 'bot-2'])
    expect(rows[0].isSelf).toBe(true)
    expect(rows.filter((r) => r.isBot)).toHaveLength(3)
    expect(rows[3].time).toBeNull()
    expect(rows[0].time).toBe('2:08.40')
    expect(rows[2].best).toBe('-:--.--')
  })

  it('isRaceBotId 只認 bot- 前綴', () => {
    expect(isRaceBotId('bot-0')).toBe(true)
    expect(isRaceBotId('robot')).toBe(false)
  })
})

describe('手機觸控鈕（AC8、spec §9.3）', () => {
  it('2×2：上排道具／煞車、下排甩尾／油門', () => {
    expect(RACE_TOUCH_ACTIONS.map((a) => a.key)).toEqual(['e', 's', ' ', 'w'])
  })
})

describe('RaceHudView 元件（假資料靜態渲染）', () => {
  const render = (hud: RaceHud, opts: { banner?: boolean; bestFlash?: boolean } = {}) =>
    renderToStaticMarkup(createElement(RaceHudView, { hud, ...opts }))

  it('根節點 [data-race-hud]，不出現其他三款 HUD', () => {
    const html = render(race())
    expect(html).toContain('data-race-hud=""')
    expect(html).not.toContain('data-tank-hud')
    expect(html).not.toContain('data-bomber-hud')
    expect(html).not.toContain('data-kitchen-hud')
  })

  it('名次大字、圈數、圈時與最佳圈', () => {
    const html = render(race())
    expect(html).toContain('data-race-rank="4"')
    expect(html).toContain('>4<')
    expect(html).toContain('>th<')
    expect(html).toContain('/4')
    expect(html).toContain('data-race-lap="2"')
    expect(html).toContain('/3')
    expect(html).toContain('0:18.42')
    expect(html).toContain('0:41.07')
    expect(html).toContain('data-race-tone="plain"')
  })

  it('圈數照送來的值直接顯示（不換算）', () => {
    expect(render(race({ lap: 1 }))).toContain('data-race-lap="1"')
    expect(render(race({ lap: 3 }))).toContain('data-race-lap="3"')
  })

  it('道具欄：持有／空／轉盤三態', () => {
    expect(render(race())).toContain('data-race-item="mushroom"')
    expect(render(race({ item: null }))).toContain('data-race-item="empty"')
    const rolling = render(race({ item: null, rolling: true }))
    expect(rolling).toContain('data-race-item="rolling"')
    expect(rolling).toContain('race-item-rolling')
    // 膠卷 4 種＋首張重複一次接縫
    expect(rolling.match(/data-race-reel="/g)).toHaveLength(5)
  })

  it('小地圖：4 個車點、自己較大', () => {
    const html = render(race())
    expect(html).toContain('data-race-map=""')
    expect(html.match(/data-race-car="/g)).toHaveLength(4)
    expect(html).toContain('data-race-car="self"')
  })

  it('逆向警告只在 wrongWay 時出現', () => {
    expect(render(race())).not.toContain('data-race-wrongway')
    const html = render(race({ wrongWay: true }))
    expect(html).toContain('data-race-wrongway=""')
    expect(html).toContain('逆向行駛！')
  })

  it('最後一圈：膠囊變色；大字由 banner 決定', () => {
    const html = render(race({ lap: 3, finalLap: true }))
    expect(html).toContain('race-lap-final')
    expect(html).not.toContain('data-race-finallap')
    expect(render(race({ lap: 3, finalLap: true }), { banner: true })).toContain('最後一圈！')
  })

  it('新最佳圈時 BEST 閃色', () => {
    expect(render(race())).not.toContain('race-time-best-new')
    expect(render(race(), { bestFlash: true })).toContain('race-time-best-new')
  })

  it('衝線名次表：finished 才出現、依名次排、衝線中的列淡化', () => {
    expect(render(race({ results: RESULTS }))).not.toContain('data-race-results')
    const html = render(race({ finished: true, results: RESULTS, rank: 1 }))
    expect(html).toContain('data-race-results=""')
    expect(html).toContain('完賽！')
    expect(html.match(/data-race-row="/g)).toHaveLength(4)
    const order = [...html.matchAll(/data-race-row="([^"]+)"/g)].map((m) => m[1])
    expect(order).toEqual(['me', 'bot-1', 'bot-0', 'bot-2'])
    expect(html).toContain('>你<')
    expect(html.match(/class="race-ai-tag"/g)).toHaveLength(3)
    expect(html).toContain('衝線中…')
    expect(html.match(/race-results-row-pending/g)).toHaveLength(1)
  })
})
