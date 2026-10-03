import { useEffect, useId, useRef, useState, type CSSProperties, type Ref } from 'react'
import { AlarmClock, ChevronRight, Crosshair, Flame, Heart, Shield, SquareArrowDown, Zap } from 'lucide-react'
import type { TankBuffKind, TankHud, TankHudBuff, TankHudPlayer } from '@/babylon/types'
import { hudScale, playerLabel } from '@/pages/Battle/bomberHud'
import {
  TANK_BUFFS,
  TANK_COLORS,
  feedView,
  hpView,
  sortTankPlayers,
  splitTankColumns,
  tankTimerView,
  type FeedSide,
  type TankFeedItem,
} from '@/pages/Battle/tankHud'

const INK = '#2B2440'

/** 玩家色以 CSS 變數交給 .tank-* class 取用 */
function colorVars(colorIndex: number): CSSProperties {
  const c = TANK_COLORS[colorIndex] ?? TANK_COLORS[0]
  return { '--tc-light': c.light, '--tc-base': c.base, '--tc-dark': c.dark } as CSSProperties
}

/** Q 版玩具坦克正視頭像（spec §9.5）：履帶、車身、圓頂、臉板、砲口；真人插三角旗、bot 改青色天線球 */
export function TankAvatar({ colorIndex, isBot, className }: { colorIndex: number; isBot: boolean; className?: string }) {
  const c = TANK_COLORS[colorIndex] ?? TANK_COLORS[0]
  const uid = useId().replace(/[^\w-]/g, '')
  const bodyId = `tank-body-${uid}`
  const domeId = `tank-dome-${uid}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </linearGradient>
        <radialGradient id={domeId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="50%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>
      <g stroke={INK} strokeWidth="2">
        <rect x="8" y="38" width="14" height="20" rx="4" fill="#4A4566" />
        <rect x="42" y="38" width="14" height="20" rx="4" fill="#4A4566" />
        <rect x="16" y="36" width="32" height="18" rx="5" fill={`url(#${bodyId})`} />
        <rect x="18" y="30" width="28" height="10" rx="4" fill={c.base} />
        <path d="M20 30 A12 9 0 0 1 44 30 Z" fill={`url(#${domeId})`} />
        <rect x="24" y="24" width="16" height="7" rx="2" fill="#FFF1E0" />
        <ellipse cx="28.5" cy="27.5" rx="1.6" ry="2.2" fill={INK} />
        <ellipse cx="35.5" cy="27.5" rx="1.6" ry="2.2" fill={INK} />
        <circle cx="32" cy="40" r="5" fill="#5B6285" />
        <circle cx="32" cy="40" r="2" fill={INK} />
        <line x1="24" y1="24" x2="24" y2="8" />
        {isBot ? (
          <circle cx="24" cy="8" r="3.5" fill="#39E6FF" />
        ) : (
          <path d="M24 8 L34 11 L24 14 Z" fill={c.base} />
        )}
      </g>
    </svg>
  )
}

/** 三連發圖示（spec §9.5）：三道扇形彈軌，末端各一顆子彈 */
export function TripleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M12 20 L12 6 M12 20 L6.5 7.5 M12 20 L17.5 7.5" strokeWidth="2.6" strokeLinecap="round" />
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="6" cy="6.5" r="2.4" />
        <circle cx="18" cy="6.5" r="2.4" />
      </g>
    </svg>
  )
}

function BuffIcon({ kind, className }: { kind: TankBuffKind; className?: string }) {
  if (kind === 'speed') return <Zap className={className} />
  if (kind === 'rapid') return <Flame className={className} />
  return <TripleIcon className={className} />
}

function buffStyle(kind: TankBuffKind): CSSProperties {
  const b = TANK_BUFFS[kind]
  return { backgroundColor: b.bg, color: b.fg }
}

function BuffBadge({ buff }: { buff: TankHudBuff }) {
  return (
    <span
      className={`tank-buff tank-buff-${buff.kind}`}
      style={buffStyle(buff.kind)}
      data-tank-buff={buff.kind}
      aria-label={`${TANK_BUFFS[buff.kind].label} ${buff.remainSec} 秒`}
    >
      <BuffIcon kind={buff.kind} className="tank-buff-icon" />
      <span className="tank-num">{buff.remainSec}s</span>
    </span>
  )
}

function HpRow({ p }: { p: TankHudPlayer }) {
  const hp = hpView(p.hp, p.maxHp)
  return (
    <div className="tank-card-hp" aria-label={`血量 ${p.hp}/${p.maxHp}`}>
      {hp.mode === 'hearts' ? (
        hp.hearts.map((on, i) => <Heart key={i} className={on ? 'tank-heart tank-heart-on' : 'tank-heart tank-heart-off'} />)
      ) : (
        <>
          <Heart className="tank-heart tank-heart-on" />
          <span className="tank-num tank-card-hp-text">{hp.text}</span>
        </>
      )}
    </div>
  )
}

function PlayerCard({ p }: { p: TankHudPlayer }) {
  return (
    <div
      className={p.alive ? 'tank-card' : 'tank-card tank-card-dead'}
      style={colorVars(p.colorIndex)}
      data-tank-card={p.colorIndex}
      data-alive={p.alive}
      title={p.name}
    >
      <div className="tank-card-head">
        <span className="tank-card-name">{p.isSelf ? '你' : p.name}</span>
        <span className="tank-card-tags">
          {p.isBot && <span className="tank-ai-tag">AI</span>}
          <span className="tank-card-no">{playerLabel(p.colorIndex)}</span>
        </span>
      </div>
      {!p.alive && <span className="tank-card-skull">💀</span>}
      <div className="tank-card-avatar">
        <TankAvatar colorIndex={p.colorIndex} isBot={p.isBot} className="tank-card-avatar-svg" />
      </div>
      {p.shield && (
        <span className="tank-card-shield" data-tank-shield="card" aria-label="護盾">
          <Shield className="tank-card-shield-icon" />
        </span>
      )}
      <HpRow p={p} />
      <div className="tank-card-kills" aria-label={`擊殺 ${p.kills}`}>
        <Crosshair className="tank-card-kills-icon" />
        <span className="tank-num">× {p.kills}</span>
      </div>
      <div className="tank-card-buffs">
        {p.buffs.map((b) => (
          <BuffBadge key={b.kind} buff={b} />
        ))}
      </div>
    </div>
  )
}

/** 矮畫面（max-height 500px）改用的頭像膠囊：頭像、HP、擊殺、buff 小圓 */
function PlayerPill({ p }: { p: TankHudPlayer }) {
  const cls = ['tank-pill', !p.alive && 'tank-card-dead', p.shield && 'tank-pill-shield'].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={colorVars(p.colorIndex)}
      data-tank-pill={p.colorIndex}
      data-alive={p.alive}
      title={`${playerLabel(p.colorIndex)} ${p.name}`}
    >
      {p.shield && <Shield className="tank-pill-shield-icon" data-tank-shield="pill" aria-label="護盾" />}
      <TankAvatar colorIndex={p.colorIndex} isBot={p.isBot} className="tank-pill-avatar" />
      <span className="tank-pill-stat">
        <Heart className="tank-pill-icon tank-pill-hp" />
        {p.hp}
      </span>
      <span className="tank-pill-stat">
        <Crosshair className="tank-pill-icon tank-pill-kills" />
        {p.kills}
      </span>
      {p.buffs.map((b) => (
        <span key={b.kind} className="tank-pill-buff" style={buffStyle(b.kind)} data-tank-buff={b.kind}>
          <BuffIcon kind={b.kind} className="tank-pill-buff-icon" />
        </span>
      ))}
      {!p.alive && <span className="tank-pill-skull">💀</span>}
    </div>
  )
}

function FeedName({ side }: { side: FeedSide }) {
  return (
    <>
      <span className="tank-feed-dot" style={side.colorIndex === null ? undefined : colorVars(side.colorIndex)} />
      <span className="tank-feed-name">{side.name}</span>
    </>
  )
}

function FeedRow({ item, players }: { item: TankFeedItem; players: TankHudPlayer[] }) {
  const v = feedView(item, players)
  return (
    <div
      className={item.leaving ? 'tank-feed-item tank-feed-leave' : 'tank-feed-item'}
      data-tank-feed={v.killer ? 'kill' : 'wall'}
    >
      {v.killer ? (
        <>
          <FeedName side={v.killer} />
          <Crosshair className="tank-feed-icon tank-feed-kill" />
        </>
      ) : (
        <>
          <SquareArrowDown className="tank-feed-icon tank-feed-wall" />
          <span className="tank-feed-name">落牆</span>
          <ChevronRight className="tank-feed-chevron" />
        </>
      )}
      <FeedName side={v.victim} />
    </div>
  )
}

interface TankHudViewProps {
  hud: TankHud
  /** 畫面上的擊殺通知（含淡出中），由外層依 hud.feed 管理 */
  feed: TankFeedItem[]
  scale?: number
  rootRef?: Ref<HTMLDivElement>
}

/** 坦克 HUD 的純呈現（無副作用，可在 node 靜態渲染自查） */
export function TankHudView({ hud, feed, scale = 1, rootRef }: TankHudViewProps) {
  const { left, right } = splitTankColumns(hud.players)
  const timer = tankTimerView(hud)
  return (
    <div ref={rootRef} className="tank-hud" style={{ '--tank-scale': scale } as CSSProperties} data-tank-hud="">
      <div className={`tank-timer tank-timer-${timer.mode}`} data-tank-timer={timer.mode}>
        <AlarmClock className="tank-timer-icon" />
        <span className={timer.mode === 'sudden' ? 'tank-timer-sudden-text' : 'tank-timer-text'}>{timer.text}</span>
        <span className="tank-timer-sep" />
        <span className="tank-timer-alive">
          存活 {hud.aliveCount}/{hud.players.length}
        </span>
      </div>
      <div className="tank-col tank-col-left">
        {left.map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>
      <div className="tank-col tank-col-right">
        {right.map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>
      <div className="tank-pills">
        {sortTankPlayers(hud.players).map((p) => (
          <PlayerPill key={p.id} p={p} />
        ))}
      </div>
      <div className="tank-feed">
        {feed.map((f) => (
          <FeedRow key={f.id} item={f} players={hud.players} />
        ))}
      </div>
    </div>
  )
}

/**
 * 坦克的 React HUD（spec §9）：左 P1／P3、右 P2／P4 玩家卡，頂部中央計時膠囊，右上擊殺通知。
 * 以 960×540 設計尺寸排版，依容器等比縮放（--tank-scale）；矮畫面由 CSS 切成頭像膠囊。
 */
export function TankHud({ hud, feed }: { hud: TankHud; feed: TankFeedItem[] }) {
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

  return <TankHudView hud={hud} feed={feed} scale={scale} rootRef={rootRef} />
}

export default TankHud
