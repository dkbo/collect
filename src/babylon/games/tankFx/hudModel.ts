/**
 * 坦克 React HUD 的資料組裝（共用契約 TankHud，純函式）：tank.ts 每幀呼叫一次，交給 ctx.setHud。
 * 每次回傳新物件；秒數一律量化到整秒，內容沒變時 BabylonCanvas 會略過重繪。
 */
import type { TankBuffKind, TankHud, TankHudFeed, TankHudPlayer } from '@/babylon/types'

export interface HudEntity {
  id: string
  name: string
  colorIndex: number
  isBot: boolean
}

export interface HudStat {
  alive: boolean
  hp: number
  maxHp: number
  kills: number
  shieldUntil: number
  speedUntil: number
  rapidUntil: number
  tripleUntil: number
}

export interface TankTimer {
  remainSec: number
  suddenDeath: boolean
}

/** 到突然死亡的剩餘秒數：倒數中顯示完整時長、結算凍結在最後一次 playing 的值 */
export function tankTimer(o: {
  phase: string
  now: number
  playingSince: number
  suddenMs: number
  last: TankTimer | null
}): TankTimer {
  const full = { remainSec: Math.ceil(o.suddenMs / 1000), suddenDeath: false }
  if (o.phase === 'result') return o.last ?? full
  if (o.phase !== 'playing' || o.playingSince === 0) return full
  const left = o.suddenMs - (o.now - o.playingSince)
  return left > 0 ? { remainSec: Math.ceil(left / 1000), suddenDeath: false } : { remainSec: 0, suddenDeath: true }
}

const FEED_MAX = 3

/** 擊殺通知：只留最近 3 則；id 單調遞增、新一局 clear 也不歸零（React key 不會撞） */
export class KillFeed {
  private seq = 0
  private list: TankHudFeed[] = []

  /** ids 可選：帶上實體 id，HUD 依 id 找色點（同名玩家不混淆） */
  push(killer: string | null, victim: string, ids?: { killerId: string | null; victimId: string }): void {
    this.list = [...this.list, { id: ++this.seq, killer, victim, ...ids }].slice(-FEED_MAX)
  }

  clear(): void {
    this.list = []
  }

  items(): TankHudFeed[] {
    return this.list.map((f) => ({ ...f }))
  }
}

const BUFF_ORDER: readonly { kind: TankBuffKind; key: 'speedUntil' | 'rapidUntil' | 'tripleUntil' }[] = [
  { kind: 'speed', key: 'speedUntil' },
  { kind: 'rapid', key: 'rapidUntil' },
  { kind: 'triple', key: 'tripleUntil' },
]

const toColorIndex = (ci: number): 0 | 1 | 2 | 3 => Math.min(3, Math.max(0, Math.trunc(ci))) as 0 | 1 | 2 | 3

export function buildTankHud(o: {
  entities: readonly HudEntity[]
  selfId: string
  now: number
  timer: TankTimer
  stat: (id: string) => HudStat
  feed: readonly TankHudFeed[]
}): TankHud {
  const players: TankHudPlayer[] = o.entities.map((e) => {
    const s = o.stat(e.id)
    return {
      id: e.id,
      name: e.name,
      colorIndex: toColorIndex(e.colorIndex),
      isSelf: e.id === o.selfId,
      isBot: e.isBot,
      alive: s.alive,
      hp: s.hp,
      maxHp: s.maxHp,
      kills: s.kills,
      shield: s.shieldUntil > o.now,
      buffs: BUFF_ORDER.filter((b) => s[b.key] > o.now).map((b) => ({
        kind: b.kind,
        remainSec: Math.ceil((s[b.key] - o.now) / 1000),
      })),
    }
  })
  return {
    kind: 'tank',
    remainSec: o.timer.remainSec,
    suddenDeath: o.timer.suddenDeath,
    aliveCount: players.filter((p) => p.alive).length,
    players,
    feed: o.feed.map((f) => ({ ...f })),
  }
}
