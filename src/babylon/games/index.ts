import type { GameType } from '@/core/room'
import type { GameFactory } from '@/babylon/types'
import { createPlaceholderScene } from './placeholderScene'
import { createRaceScene } from './race'
import { createBomberScene } from './bomber'
import { createOvercookedScene } from './overcooked'

/**
 * gameType → GameModule 工廠。
 * tank 暫指向佔位場景（可移動方塊 demo），實際坦克玩法後續接入。
 */
const REGISTRY: Record<GameType, GameFactory> = {
  tank: createPlaceholderScene,
  race: createRaceScene,
  bomber: createBomberScene,
  overcooked: createOvercookedScene,
}

/** 取得對應遊戲工廠（未登記則回佔位場景，避免開局崩潰） */
export const getGameFactory = (gameType: GameType): GameFactory =>
  REGISTRY[gameType] ?? createPlaceholderScene
