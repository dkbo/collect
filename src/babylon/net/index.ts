/**
 * Babylon 多人遊戲共用網路工具層（Phase A，見 .prompts/babylon-multiplayer-games.md §2）。
 * 保留訊息 type：'snap'、'own'、'flow'；遊戲自訂訊息請避開。
 */
export { createFixedTicker, type FixedTicker } from './fixedTick'
export {
  createSnapshotBuffer,
  createHostSnapshot,
  createSnapshotReceiver,
  type SnapshotBuffer,
  type SnapshotPair,
  type HostSnapshotSender,
} from './snapshotSync'
export { createOwnershipSync, type OwnershipSync } from './ownership'
export {
  createGameFlow,
  canAdvanceMidRound,
  type GameFlow,
  type FlowPhase,
  type FlowState,
} from './gameFlow'
export {
  isObj,
  isNum,
  isNumIn,
  isIntIn,
  isStr,
  isOneOf,
  isArrayOf,
  isStrArray,
  isCell,
  isCellArray,
  clampNum,
} from './guards'
