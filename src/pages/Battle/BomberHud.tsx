import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { AlarmClock, Bomb, Flame, Footprints, Hand, Shield, Star, Zap } from 'lucide-react'
import type { GameHud, GameHudPlayer } from '@/babylon/types'
import {
  BOMBER_COLORS,
  hudScale,
  invincibleSeconds,
  playerLabel,
  splitColumns,
  timerView,
  winStars,
} from '@/pages/Battle/bomberHud'

/** 玩家色以 CSS 變數交給 .bomber-* class 取用 */
function colorVars(colorIndex: number): CSSProperties {
  const c = BOMBER_COLORS[colorIndex] ?? BOMBER_COLORS[0]
  return { '--bc-light': c.light, '--bc-base': c.base, '--bc-dark': c.dark } as CSSProperties
}

/** Q 版頭像（inline SVG，依 colorIndex 上色）：頭盔徑向漸層、臉 #FFF1E0、眼睛帶白色光點；AI 天線球青色加 AI 小章 */
export function BomberAvatar({ colorIndex, isAI, className }: { colorIndex: number; isAI: boolean; className?: string }) {
  const c = BOMBER_COLORS[colorIndex] ?? BOMBER_COLORS[0]
  const gradId = `bomber-helmet-${useId().replace(/[^\w-]/g, '')}`
  const ink = '#2B2440'
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="50%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>
      <rect x="21" y="41" width="22" height="15" rx="6" fill={c.base} stroke={ink} strokeWidth="2" />
      <rect x="22" y="47" width="20" height="3" fill={c.dark} />
      <circle cx="18" cy="46" r="3.5" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <circle cx="46" cy="46" r="3.5" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <line x1="32" y1="11" x2="32" y2="5" stroke={ink} strokeWidth="2" />
      <circle cx="32" cy="5" r="3.5" fill={isAI ? '#39E6FF' : '#FF5AA8'} stroke={ink} strokeWidth="1.5" />
      <circle cx="32" cy="26" r="15" fill={`url(#${gradId})`} stroke={ink} strokeWidth="2" />
      <rect x="21.5" y="21" width="21" height="14" rx="6.5" fill="#FFF1E0" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="28" cy="28" rx="2.3" ry="3.3" fill={ink} />
      <ellipse cx="36" cy="28" rx="2.3" ry="3.3" fill={ink} />
      <circle cx="28.8" cy="26.6" r="0.9" fill="#fff" />
      <circle cx="36.8" cy="26.6" r="0.9" fill="#fff" />
      {isAI && (
        <g>
          <rect x="40" y="8" width="15" height="9" rx="3" fill="#39E6FF" stroke={ink} strokeWidth="1.5" />
          <text x="47.5" y="15" textAnchor="middle" fontSize="7" fontWeight="900" fill={ink}>
            AI
          </text>
        </g>
      )}
    </svg>
  )
}

function PlayerCard({ p }: { p: GameHudPlayer }) {
  const inv = invincibleSeconds(p.invincibleMs)
  return (
    <div
      className={p.alive ? 'bomber-card' : 'bomber-card bomber-card-dead'}
      style={colorVars(p.colorIndex)}
      data-bomber-card={p.colorIndex}
      data-alive={p.alive}
      title={p.name}
    >
      <div className="bomber-card-head">
        <span className="bomber-card-name">{p.isSelf ? '你' : p.name}</span>
        <span className="bomber-card-no">{playerLabel(p.colorIndex)}</span>
      </div>
      {!p.alive && <span className="bomber-card-skull">💀</span>}
      <div className="bomber-card-avatar">
        <BomberAvatar colorIndex={p.colorIndex} isAI={p.isAI} className="bomber-card-avatar-svg" />
      </div>
      <div className="bomber-card-stars" aria-label={`勝場 ${p.wins}`}>
        {p.isAI && <span className="bomber-ai-tag">AI</span>}
        {winStars(p.wins).map((won, i) => (
          <Star key={i} className={won ? 'bomber-star bomber-star-won' : 'bomber-star'} />
        ))}
      </div>
      <div className="bomber-card-stats">
        <div className="bomber-stat" aria-label="炸彈數">
          <Bomb className="bomber-stat-icon bomber-stat-bomb" />
          <span className="bomber-num">{p.bombs}</span>
        </div>
        <div className="bomber-stat" aria-label="火力">
          <Flame className="bomber-stat-icon bomber-stat-fire" />
          <span className="bomber-num">{p.fire}</span>
        </div>
        <div className="bomber-stat" aria-label="速度">
          <Zap className="bomber-stat-icon bomber-stat-speed" />
          <span className="bomber-num">{p.speed}</span>
        </div>
      </div>
      <div className="bomber-card-badges">
        {p.kick && (
          <span className="bomber-badge" data-bomber-badge="kick" aria-label="踢彈">
            <Footprints className="bomber-badge-icon" />
          </span>
        )}
        {p.throw && (
          <span className="bomber-badge" data-bomber-badge="throw" aria-label="丟彈">
            <Hand className="bomber-badge-icon" />
          </span>
        )}
        {inv > 0 && (
          <span className="bomber-badge bomber-badge-inv" data-bomber-badge="invincible" aria-label="無敵">
            <Shield className="bomber-badge-icon" />
            <span className="bomber-num">{inv}s</span>
          </span>
        )}
      </div>
    </div>
  )
}

/** 矮畫面（max-height 500px）改用的頭像膠囊：頭像加炸彈／火力／速度三個小數字 */
function PlayerPill({ p }: { p: GameHudPlayer }) {
  const inv = p.alive && invincibleSeconds(p.invincibleMs) > 0
  const cls = ['bomber-pill', !p.alive && 'bomber-card-dead', inv && 'bomber-pill-inv'].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={colorVars(p.colorIndex)}
      data-bomber-pill={p.colorIndex}
      data-alive={p.alive}
      data-invincible={inv}
      title={`${playerLabel(p.colorIndex)} ${p.name}`}
    >
      {inv && <Shield className="bomber-pill-inv-icon" aria-label="無敵" />}
      <BomberAvatar colorIndex={p.colorIndex} isAI={p.isAI} className="bomber-pill-avatar" />
      <span className="bomber-pill-stat">
        <Bomb className="bomber-pill-icon" />
        {p.bombs}
      </span>
      <span className="bomber-pill-stat">
        <Flame className="bomber-pill-icon" />
        {p.fire}
      </span>
      <span className="bomber-pill-stat">
        <Zap className="bomber-pill-icon" />
        {p.speed}
      </span>
      {!p.alive && <span className="bomber-pill-skull">💀</span>}
    </div>
  )
}

/**
 * bomber 的 React HUD（spec §9）：左 P1／P3、右 P2／P4 玩家卡，頂部中央計時器膠囊。
 * 以 960×540 設計尺寸排版，依容器大小等比縮放（--bomber-scale）；矮畫面由 CSS 切成頭像膠囊。
 */
export function BomberHud({ hud }: { hud: GameHud }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setScale(hudScale(el.clientWidth, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { left, right } = splitColumns(hud.players)
  const timer = timerView(hud.timer)

  return (
    <div
      ref={rootRef}
      className="bomber-hud"
      style={{ '--bomber-scale': scale } as CSSProperties}
      data-bomber-hud=""
    >
      <div className={`bomber-timer bomber-timer-${timer.mode}`} data-bomber-timer={timer.mode}>
        <AlarmClock className="bomber-timer-icon" />
        <span className={timer.mode === 'sudden' ? 'bomber-timer-sudden-text' : 'bomber-timer-text'}>
          {timer.text}
        </span>
        <span className="bomber-timer-sep" />
        <span className="bomber-timer-alive">
          存活 {hud.aliveCount}/{hud.totalCount}
        </span>
      </div>
      <div className="bomber-col bomber-col-left">
        {left.map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>
      <div className="bomber-col bomber-col-right">
        {right.map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>
      <div className="bomber-pills">
        {[...hud.players]
          .sort((a, b) => a.colorIndex - b.colorIndex)
          .map((p) => (
            <PlayerPill key={p.id} p={p} />
          ))}
      </div>
    </div>
  )
}

export default BomberHud
