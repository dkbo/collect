/**
 * 子彈壽命（純函式）：以模擬時間累計，不看真實時間。
 * host 掉幀時 fixedTick 會截斷補步，子彈少飛的那段壽命也跟著不算；
 * host 與 guest 同起點、同 tick 數即同壽命，guest 的反彈預測不會跑出 host 不存在的幽靈彈。
 */
import { stepBullet, type BulletKin, type BulletStep } from '@/babylon/games/tankFx/bounce'
import type { CellPred } from '@/babylon/games/tankFx/grid'

/** 坦克模擬頻率（tank.ts 以 createFixedTicker(SIM_HZ) 推進；單測由此推導 dt，頻率改了測試會跟著） */
export const SIM_HZ = 30

export interface AgedBullet extends BulletKin {
  /** 已飛行的模擬時間（ms） */
  age: number
}

/**
 * timeout：壽命到期（飛太久）；與 stepBullet 的 expire（撞牆且反彈次數用完／起點在牆內）不同。
 * 兩者目前都只是移除子彈，日後要對「撞牆消失」播特效時記得分開處理。
 */
export type AgedStep = BulletStep | { kind: 'timeout' }

/** 推進一個 tick：先累加壽命，超過 lifetimeMs 即到期（不再移動），否則照 stepBullet 推進 */
export function advanceBullet(
  b: AgedBullet,
  dt: number,
  lifetimeMs: number,
  isWall: CellPred,
  isCrate: CellPred,
): { age: number; step: AgedStep } {
  const age = b.age + dt * 1000
  if (age > lifetimeMs) return { age, step: { kind: 'timeout' } }
  return { age, step: stepBullet(b, dt, isWall, isCrate) }
}
