/**
 * /battle 音效系統入口：re-export + attachFlowAudio。
 * 各遊戲在 createGameFlow 後一行掛上共用事件音（倒數嗶/GO/結算/BGM 切換），
 * net 層（gameFlow）不依賴 audio。
 */
import type { GameFlow } from '@/babylon/net'
import type { GameType } from '@/core/room'
import { engineStop, playSfx, type SfxName } from './sfx'
import { startBgm, stopBgm } from './bgm'

export { getMuted, setMuted } from './engine'
export { engineSet, engineStart, engineStop, playSfx, type SfxName } from './sfx'
export { startBgm, stopBgm } from './bgm'

/** 停止所有聲音（BGM + 引擎音），離開遊戲時呼叫 */
export const stopAllAudio = (): void => {
  stopBgm()
  engineStop()
}

export const attachFlowAudio = (
  flow: GameFlow,
  game: GameType,
  opts?: { resultSfx?: (result: unknown) => SfxName | null }
): void => {
  flow.onChange((s) => {
    if (s.phase === 'countdown') {
      stopBgm()
      // 依剩餘毫秒對齊每整秒一聲嗶（guest 中途加入收到剩餘時長也能接上）
      const remain = flow.countdownRemaining()
      playSfx('countdown')
      for (let k = Math.ceil(remain / 1000) - 1; k >= 1; k--) {
        playSfx('countdown', (remain - k * 1000) / 1000)
      }
    } else if (s.phase === 'playing') {
      playSfx('go')
      startBgm(game)
    } else if (s.phase === 'result') {
      stopBgm()
      const name = opts?.resultSfx?.(s.result)
      if (name) playSfx(name)
    } else {
      stopBgm()
    }
  })
}
