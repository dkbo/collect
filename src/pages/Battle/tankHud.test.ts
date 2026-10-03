import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GameHud, KitchenHud, TankHud, TankHudPlayer } from '@/babylon/types'
import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import { sameHud } from '@/pages/Battle/bomberHud'
import { isKitchenHud } from '@/pages/Battle/kitchenHud'
import {
  TANK_BUFFS,
  TANK_COLORS,
  TANK_FEED_LEAVE_MS,
  TANK_FEED_MAX,
  TANK_FEED_SHOW_MS,
  TANK_TOUCH_ACTIONS,
  feedView,
  freshFeed,
  hpView,
  isTankHud,
  splitTankColumns,
  tankTimerView,
} from '@/pages/Battle/tankHud'
import { TankHudView } from '@/pages/Battle/TankHud'

function player(colorIndex: 0 | 1 | 2 | 3, extra: Partial<TankHudPlayer> = {}): TankHudPlayer {
  return {
    id: `p${colorIndex}`,
    name: `玩家${colorIndex + 1}`,
    colorIndex,
    isSelf: false,
    isBot: false,
    alive: true,
    hp: 3,
    maxHp: 3,
    kills: 0,
    shield: false,
    buffs: [],
    ...extra,
  }
}

/** 假資料（照 TankHud 共用契約）：自己有護盾＋加速、真人有三連發＋連射、bot 一台陣亡 */
function tank(extra: Partial<TankHud> = {}): TankHud {
  return {
    kind: 'tank',
    remainSec: 42,
    suddenDeath: false,
    aliveCount: 3,
    players: [
      player(0, { id: 'me', name: '小紅', isSelf: true, shield: true, kills: 1, buffs: [{ kind: 'speed', remainSec: 5 }] }),
      player(1, {
        id: 'blue',
        name: '小藍',
        hp: 2,
        kills: 2,
        buffs: [
          { kind: 'triple', remainSec: 7 },
          { kind: 'rapid', remainSec: 3 },
        ],
      }),
      player(2, { id: 'bot-0', name: '電腦1', isBot: true, hp: 1 }),
      player(3, { id: 'bot-1', name: '電腦2', isBot: true, alive: false, hp: 0 }),
    ],
    feed: [
      { id: 1, killer: '小藍', victim: '電腦2' },
      { id: 2, killer: null, victim: '電腦2' },
    ],
    ...extra,
  }
}

const bomber: GameHud = { timer: { secondsLeft: 24, suddenDeath: false }, aliveCount: 1, totalCount: 1, players: [] }
const kitchen: KitchenHud = { kind: 'kitchen', remainSec: 9, score: 0, delivered: 0, orders: [], gone: [], players: [] }

describe('isTankHud', () => {
  it('kind 為 tank 才是坦克 HUD', () => {
    expect(isTankHud(tank())).toBe(true)
    expect(isTankHud(kitchen)).toBe(false)
    expect(isTankHud(bomber)).toBe(false)
    expect(isTankHud(null)).toBe(false)
  })
  it('坦克 HUD 不會被當成廚房 HUD（沒有 kind 仍當 bomber）', () => {
    expect(isKitchenHud(tank())).toBe(false)
  })
  it('sameHud：內容相同不重繪、血量變了要重繪', () => {
    expect(sameHud<TankHud>(tank(), tank())).toBe(true)
    const hurt = tank()
    hurt.players[0] = { ...hurt.players[0], hp: 2 }
    expect(sameHud<TankHud>(tank(), hurt)).toBe(false)
  })
})

describe('色票', () => {
  it('直接取 fx/palette 的 PLAYER_PALETTE，不另存一份', () => {
    expect(TANK_COLORS).toBe(PLAYER_PALETTE)
  })
  it('三種 buff 照 spec §2.3 上色', () => {
    expect(TANK_BUFFS.speed).toMatchObject({ bg: '#FFD23F', fg: '#3A2A00' })
    expect(TANK_BUFFS.rapid).toMatchObject({ bg: '#FF6B3D', fg: '#FFFFFF' })
    expect(TANK_BUFFS.triple).toMatchObject({ bg: '#B07CFF', fg: '#FFFFFF' })
  })
})

describe('計時膠囊', () => {
  it('m:ss 顯示到突然死亡的倒數', () => {
    expect(tankTimerView(tank({ remainSec: 75 }))).toEqual({ mode: 'normal', text: '1:15' })
  })
  it('最後 10 秒（含）變紅跳動', () => {
    expect(tankTimerView(tank({ remainSec: 10 })).mode).toBe('urgent')
    expect(tankTimerView(tank({ remainSec: 11 })).mode).toBe('normal')
  })
  it('進入突然死亡後變「縮圈中」，忽略 remainSec', () => {
    expect(tankTimerView(tank({ remainSec: 0, suddenDeath: true }))).toEqual({ mode: 'sudden', text: '縮圈中' })
  })
})

describe('HP', () => {
  it('maxHp ≤ 6 畫成一排心：還有的在前', () => {
    expect(hpView(2, 3)).toEqual({ mode: 'hearts', hearts: [true, true, false] })
    expect(hpView(0, 6)).toEqual({ mode: 'hearts', hearts: [false, false, false, false, false, false] })
  })
  it('maxHp > 6 改成 hp/maxHp', () => {
    expect(hpView(5, 8)).toEqual({ mode: 'count', text: '5/8' })
  })
  it('hp 夾在 0–maxHp、非有限值當 0', () => {
    expect(hpView(9, 3)).toEqual({ mode: 'hearts', hearts: [true, true, true] })
    expect(hpView(-1, 3)).toEqual({ mode: 'hearts', hearts: [false, false, false] })
    expect(hpView(Number.NaN, 2)).toEqual({ mode: 'hearts', hearts: [false, false] })
  })
})

describe('玩家卡分欄', () => {
  it('左欄 P1／P3、右欄 P2／P4，依 P 編號排序', () => {
    const { left, right } = splitTankColumns([player(3), player(1), player(2), player(0)])
    expect(left.map((p) => p.colorIndex)).toEqual([0, 2])
    expect(right.map((p) => p.colorIndex)).toEqual([1, 3])
  })
})

describe('擊殺通知', () => {
  it('只收沒看過的 id，依 id 由舊到新', () => {
    const feed = [
      { id: 5, killer: 'a', victim: 'b' },
      { id: 4, killer: null, victim: 'c' },
    ]
    expect(freshFeed(new Set([4]), feed).map((f) => f.id)).toEqual([5])
    expect(freshFeed(new Set(), feed).map((f) => f.id)).toEqual([4, 5])
  })
  it('一次最多 3 則、3 秒後淡出 300ms', () => {
    expect(TANK_FEED_MAX).toBe(3)
    expect(TANK_FEED_SHOW_MS).toBe(3000)
    expect(TANK_FEED_LEAVE_MS).toBe(300)
  })
  it('依名字找色點；落牆沒有擊殺者', () => {
    const hud = tank()
    expect(feedView({ id: 1, killer: '小藍', victim: '電腦2' }, hud.players)).toEqual({
      killer: { name: '小藍', colorIndex: 1 },
      victim: { name: '電腦2', colorIndex: 3 },
    })
    expect(feedView({ id: 2, killer: null, victim: '小紅' }, hud.players)).toEqual({
      killer: null,
      victim: { name: '小紅', colorIndex: 0 },
    })
  })
  it('名冊找不到的名字照樣顯示、色點留空', () => {
    expect(feedView({ id: 3, killer: '離房的人', victim: '電腦1' }, tank().players).killer).toEqual({
      name: '離房的人',
      colorIndex: null,
    })
  })
})

describe('手機觸控鈕（AC4）', () => {
  it('砲塔左轉 q、右轉 e，開火放最右', () => {
    expect(TANK_TOUCH_ACTIONS.map((a) => a.key)).toEqual(['q', 'e', ' '])
  })
})

describe('TankHudView 元件（假資料靜態渲染）', () => {
  const render = (hud: TankHud, feed = hud.feed.map((f) => ({ ...f, leaving: false }))) =>
    renderToStaticMarkup(createElement(TankHudView, { hud, feed }))

  it('根節點 [data-tank-hud]，不出現 bomber／kitchen HUD', () => {
    const html = render(tank())
    expect(html).toContain('data-tank-hud=""')
    expect(html).not.toContain('data-bomber-hud')
    expect(html).not.toContain('data-kitchen-hud')
  })

  it('4 張玩家卡含 bot：自己掛「你」、bot 掛 AI、陣亡灰化', () => {
    const html = render(tank())
    expect(html.match(/data-tank-card="/g)).toHaveLength(4)
    expect(html).toContain('>你<')
    expect(html.match(/class="tank-ai-tag"/g)).toHaveLength(2)
    expect(html.match(/tank-card tank-card-dead/g)).toHaveLength(1)
    expect(html).toContain('data-alive="false"')
  })

  it('單人只列實際張數', () => {
    const html = render(tank({ players: [player(0, { isSelf: true })], aliveCount: 1, feed: [] }))
    expect(html.match(/data-tank-card="/g)).toHaveLength(1)
  })

  it('HP 心數、擊殺數、護盾標', () => {
    const html = render(tank())
    // 卡片 3+3+3+3 顆心、膠囊不畫心串
    expect(html.match(/tank-heart-on/g)).toHaveLength(3 + 2 + 1)
    expect(html.match(/tank-heart-off/g)).toHaveLength(0 + 1 + 2 + 3)
    expect(html).toContain('× 2')
    expect(html.match(/data-tank-shield="card"/g)).toHaveLength(1)
    expect(html.match(/data-tank-shield="pill"/g)).toHaveLength(1)
  })

  it('三種 buff 徽章帶剩餘秒數', () => {
    const html = render(tank())
    expect(html).toContain('data-tank-buff="speed"')
    expect(html).toContain('data-tank-buff="triple"')
    expect(html).toContain('data-tank-buff="rapid"')
    expect(html).toContain('5s')
    expect(html).toContain('7s')
    expect(html).toContain('3s')
  })

  it('計時膠囊：倒數與存活數；縮圈中變紅', () => {
    const html = render(tank())
    expect(html).toContain('data-tank-timer="normal"')
    expect(html).toContain('0:42')
    expect(html).toContain('存活 3/4')
    const sd = render(tank({ remainSec: 0, suddenDeath: true }))
    expect(sd).toContain('data-tank-timer="sudden"')
    expect(sd).toContain('縮圈中')
  })

  it('擊殺通知：擊殺與落牆兩種、淡出中的掛 leave', () => {
    const hud = tank()
    const html = render(hud, [
      { ...hud.feed[0], leaving: true },
      { ...hud.feed[1], leaving: false },
    ])
    expect(html.match(/data-tank-feed="/g)).toHaveLength(2)
    expect(html).toContain('data-tank-feed="kill"')
    expect(html).toContain('data-tank-feed="wall"')
    expect(html).toContain('落牆')
    expect(html.match(/tank-feed-leave/g)).toHaveLength(1)
  })

  it('手機膠囊與玩家卡同數量（CSS 切換顯示）', () => {
    const html = render(tank())
    expect(html.match(/data-tank-pill="/g)).toHaveLength(4)
  })
})
