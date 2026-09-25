/**
 * bomber → React HUD 的資料組裝（共用契約 GameHud，純函式）。
 * 每次回傳新物件；invincibleMs 量化到 100ms、secondsLeft 量化到整秒，
 * BabylonCanvas 的 sameHud 才能把「內容沒變」的每幀呼叫擋掉。
 */
import type { GameHud, GameHudPlayer } from '@/babylon/types'
import type { ColorIndex } from '@/babylon/games/bomberFx/palette'

export interface HudEntity {
  id: string
  name: string
  isAI: boolean
  colorIndex: ColorIndex
}

export interface HudStat {
  bombs: number
  fire: number
  speed: number
  kick: boolean
  throw: boolean
  invincibleUntil: number
}

export interface HudInput {
  entities: readonly HudEntity[]
  selfId: string
  now: number
  timer: GameHud['timer']
  alive: (id: string) => boolean
  wins: (id: string) => number
  stat: (id: string) => HudStat
}

export function quantizeInvincible(ms: number): number {
  return ms > 0 ? Math.ceil(ms / 100) * 100 : 0
}

/** 距突然死亡倒數（playingSince 為 0 = 還沒開打，顯示完整時長） */
export function suddenDeathSeconds(o: { now: number; playingSince: number; suddenMs: number }): GameHud['timer'] {
  if (o.playingSince === 0) return { secondsLeft: Math.ceil(o.suddenMs / 1000), suddenDeath: false }
  const left = o.suddenMs - (o.now - o.playingSince)
  if (left < 0) return { secondsLeft: 0, suddenDeath: true }
  return { secondsLeft: Math.ceil(left / 1000), suddenDeath: false }
}

export function buildBomberHud(i: HudInput): GameHud {
  const players: GameHudPlayer[] = i.entities.map((e) => {
    const s = i.stat(e.id)
    return {
      id: e.id,
      name: e.name,
      colorIndex: e.colorIndex,
      isSelf: e.id === i.selfId,
      isAI: e.isAI,
      alive: i.alive(e.id),
      wins: i.wins(e.id),
      bombs: s.bombs,
      fire: s.fire,
      speed: s.speed,
      kick: s.kick,
      throw: s.throw,
      invincibleMs: quantizeInvincible(s.invincibleUntil - i.now),
    }
  })
  return {
    timer: { ...i.timer },
    aliveCount: players.filter((p) => p.alive).length,
    totalCount: players.length,
    players,
  }
}
