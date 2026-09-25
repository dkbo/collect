/** HUD 版面與結算文案的純函式（元件只負責呼叫與渲染） */

/** 設計稿基準：960×540 畫面、盤面寬 480、單側欄可用寬 240 */
const DESIGN_HEIGHT = 540
const DESIGN_BOARD = 480
const DESIGN_SIDE = 240
/** 兩側縮放下限：再小字就看不清（13px 標籤 < 8px），改退回上方橫條 */
const MIN_SIDE_SCALE = 0.6

export type HudLayout = { mode: 'side' | 'top'; scale: number }

/**
 * 以 `.rpg-screen` 容器寬高比決定 HUD 位置：≥ 4:3 放兩側，否則退回上方橫條；
 * 兩側縮放低於 MIN_SIDE_SCALE 時同樣退回橫條。
 * 兩側模式的縮放取「隨高度等比」與「塞進盤面旁的空間」兩者較小值
 * （Godot 盤面以 min(寬, 高) / 540 等比縮放，寬螢幕時即為高度）。
 */
export function hudLayout(width: number, height: number): HudLayout {
  if (width <= 0 || height <= 0 || width * 3 < height * 4) return { mode: 'top', scale: 1 }
  const byHeight = height / DESIGN_HEIGHT
  const side = (width - DESIGN_BOARD * byHeight) / 2
  const scale = Math.min(byHeight, side / DESIGN_SIDE)
  return scale < MIN_SIDE_SCALE ? { mode: 'top', scale: 1 } : { mode: 'side', scale }
}

/**
 * 橫條第一列需要的寬度：左右內距 12×2 ＋ LV 牌 ≈62 ＋ 間距 8 ＋ 步數球 38 ＋ 間距 8
 * ＋ 4 顆圓鈕 38×4＋6×3 = 310
 */
const TOPBAR_FULL_WIDTH = 310

/** 橫條寬度不足時改精簡排法：步數球移到第二列、圓鈕縮成 32px，第一列只剩 LV 牌與圓鈕（窄到 234px 仍放得下） */
export function isCompactTopBar(width: number): boolean {
  return width < TOPBAR_FULL_WIDTH
}

/** 覆蓋層卡片縮放：可用高度放不下卡片原始高度時等比縮小，放得下（或尺寸未知）維持 1 */
export function dialogFitScale(available: number, natural: number): number {
  if (available <= 0 || natural <= 0) return 1
  return Math.min(1, available / natural)
}

/** 星級進度條百分比：滿格 = 2 倍目標 */
export function progressPercent(score: number, target: number): number {
  return target > 0 ? Math.min((score / (2 * target)) * 100, 100) : 0
}

/** 下一顆星的門檻分數：1★ 目標、2★ 1.5 倍（捨去，同 Godot level_manager.gd）、3★ 2 倍；已三星回傳 null */
export function nextStarScore(stars: number, target: number): number | null {
  const thresholds = [target, Math.floor(target * 1.5), target * 2]
  return stars >= thresholds.length ? null : thresholds[Math.max(stars, 0)]
}

/** 步數警示門檻 */
export function isLowMoves(moves: number): boolean {
  return moves <= 5
}

const STAR_NAMES = ['第一', '第二', '第三']

/** 結算卡副標：「目標 X · 再 Y 分拿第 K 顆星」；零星（失敗）為距目標，三星改為「完美通關！」 */
export function resultSubtitle(score: number, target: number, stars: number): string {
  const next = nextStarScore(stars, target)
  if (next === null) return '完美通關！'
  const gap = Math.max(next - score, 0)
  if (stars <= 0) return `目標 ${target.toLocaleString()} · 還差 ${gap.toLocaleString()} 分過關`
  return `目標 ${target.toLocaleString()} · 再 ${gap.toLocaleString()} 分拿${STAR_NAMES[stars]}顆星`
}
