import type { GameType } from '@/core/room'
import type { GameFactory } from '@/babylon/types'
import { createPlaceholderScene } from './placeholderScene'
import { createRaceScene } from './race'
import { createBomberScene } from './bomber'
import { createOvercookedScene } from './overcooked'
import { createTankScene } from './tank'

/**
 * gameType → GameModule 工廠。
 */
const REGISTRY: Record<GameType, GameFactory> = {
  tank: createTankScene,
  race: createRaceScene,
  bomber: createBomberScene,
  overcooked: createOvercookedScene,
}

/** 取得對應遊戲工廠（未登記則回佔位場景，避免開局崩潰） */
export const getGameFactory = (gameType: GameType): GameFactory =>
  REGISTRY[gameType] ?? createPlaceholderScene
