import type { CSSProperties } from 'react'
import { HelpCircle, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useCandyStore } from '@/store/useCandyStore'
import { CandyStar } from '@/pages/CandyCrush/CandyStar'
import { isLowMoves, nextStarScore, progressPercent } from '@/pages/CandyCrush/candyHud'

/** 星級刻度：達標 1★（50%）、1.5 倍 2★（75%）、2 倍 3★（100%），進度條滿格 = 2 倍目標 */
const STAR_TICKS = [
  { star: 1, percent: 50 },
  { star: 2, percent: 75 },
  { star: 3, percent: 100 },
]

/** 兩側欄距畫面邊緣（設計尺寸 px，會乘上縮放） */
const EDGE = 24

function StarTrack({ starSize }: { starSize: number }) {
  const { score, target, stars } = useCandyStore()
  return (
    <div className="candy-track">
      <div
        className="candy-fill"
        style={{ width: `${progressPercent(score, target)}%` }}
        data-testid="hud-progress"
      />
      {STAR_TICKS.map(({ star, percent }) => (
        <CandyStar
          key={star}
          earned={stars >= star}
          size={starSize}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${Math.min(percent, 96)}%` }}
          label={`${star} 星刻度`}
        />
      ))}
    </div>
  )
}

function NextStarText() {
  const { target, stars } = useCandyStore()
  const next = nextStarScore(stars, target)
  return (
    <div className="text-[13px] text-[#d9ccff]">
      {next === null ? '已達三星！' : `下一顆星 ${next.toLocaleString()}`}
    </div>
  )
}

/** 兩側 HUD（寬高比 ≥ 4:3）：左欄關卡／目標／步數，右欄分數卡；圓鈕另由 HudButtons 疊在最上層 */
export function SideHud({ scale }: { scale: number }) {
  const { level, score, moves, target } = useCandyStore()
  const col = (side: 'left' | 'right', top: number): CSSProperties => ({
    [side]: `calc(${EDGE * scale}px + env(safe-area-inset-${side}))`,
    top: `calc(${top * scale}px + env(safe-area-inset-top))`,
    transform: `scale(${scale})`,
    transformOrigin: `top ${side}`,
  })

  return (
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="candy-hud">
      <div className="candy-hud-col" style={col('left', 40)}>
        <div className="candy-level">
          <span className="candy-level-label">LEVEL</span>
          <span className="candy-level-num" data-testid="hud-level">{level}</span>
        </div>
        <div className="candy-card text-center">
          <div className="candy-card-label">目標分數</div>
          <div className="candy-card-value">{target.toLocaleString()}</div>
        </div>
        <div className={`candy-moves mt-2 ${isLowMoves(moves) ? 'candy-moves-low' : ''}`}>
          <span className="text-[15px] font-bold text-white/90">步數</span>
          <span className="candy-moves-num" data-testid="hud-moves">{moves}</span>
        </div>
      </div>

      {/* 右欄：上方留 38px 給 HudButtons */}
      <div className="candy-hud-col" style={col('right', EDGE)}>
        <div className="h-[38px]" aria-hidden="true" />
        <div className="candy-card mt-9 flex flex-col gap-2.5 text-left">
          <div className="candy-card-label">分數</div>
          <div className="candy-score" data-testid="hud-score">{score.toLocaleString()}</div>
          <StarTrack starSize={26} />
          <NextStarText />
        </div>
      </div>
    </div>
  )
}

/** 上方橫條（寬高比 < 4:3）：第一列關卡／步數（右側留位給 HudButtons），第二列分數＋星級進度 */
export function TopBar() {
  const { level, score, moves, target } = useCandyStore()
  return (
    <div className="candy-topbar" data-testid="candy-hud">
      <div className="flex h-[38px] items-center gap-2">
        <div className="candy-level-sm">
          <span className="candy-num text-[11px] tracking-[2px] text-[#ffe4f2]">LV</span>
          <span className="candy-num text-[24px] leading-none text-white" data-testid="hud-level">{level}</span>
        </div>
        <div className={`candy-moves-sm ${isLowMoves(moves) ? 'candy-moves-low' : ''}`} title="剩餘步數" aria-label="剩餘步數">
          <span className="candy-num text-[18px] leading-none" data-testid="hud-moves">{moves}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 pb-1">
        <span className="candy-num min-w-14 text-[22px] text-[#ffe066] [text-shadow:0_2px_0_#b8520a]" data-testid="hud-score">
          {score.toLocaleString()}
        </span>
        <div className="flex-1">
          <StarTrack starSize={20} />
        </div>
        <span className="text-[11px] text-[#d9ccff] whitespace-nowrap">
          目標 <span className="candy-num text-white">{target.toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}

/**
 * 4 顆圓鈕（靜音、暫停、全螢幕、說明）。獨立疊在覆蓋層之上（z-30、DOM 後置），
 * 暫停與結算時仍可點；兩側模式對齊右欄並同步縮放，橫條模式放在橫條第一列右側。
 */
export function HudButtons({
  mode,
  scale,
  isFullscreen,
  onMute,
  onPause,
  onFullscreen,
  onHelp,
}: {
  mode: 'side' | 'top'
  scale: number
  isFullscreen: boolean
  onMute: () => void
  onPause: () => void
  onFullscreen: () => void
  onHelp: () => void
}) {
  const { isMuted, isPaused } = useCandyStore()
  const style: CSSProperties =
    mode === 'side'
      ? {
          right: `calc(${EDGE * scale}px + env(safe-area-inset-right))`,
          top: `calc(${EDGE * scale}px + env(safe-area-inset-top))`,
          transform: `scale(${scale})`,
          transformOrigin: 'top right',
        }
      : {
          right: 'calc(12px + env(safe-area-inset-right))',
          top: 'calc(8px + env(safe-area-inset-top))',
        }

  return (
    <div className="absolute z-30 flex gap-2" style={style}>
      <button
        type="button"
        className="candy-round-btn"
        onClick={onMute}
        aria-label={isMuted ? '開啟音效' : '靜音'}
        data-testid="candy-mute-btn"
      >
        {isMuted ? <VolumeX /> : <Volume2 />}
      </button>
      <button
        type="button"
        className="candy-round-btn"
        onClick={onPause}
        aria-label={isPaused ? '恢復遊戲' : '暫停遊戲'}
        data-testid="candy-pause-btn"
      >
        {isPaused ? <Play /> : <Pause />}
      </button>
      <button
        type="button"
        className="candy-round-btn"
        onClick={onFullscreen}
        aria-label="切換全螢幕"
        data-testid="candy-fullscreen-btn"
      >
        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
      </button>
      {!isFullscreen && (
        <button type="button" className="candy-round-btn" onClick={onHelp} aria-label="打開操作說明">
          <HelpCircle />
        </button>
      )}
    </div>
  )
}
