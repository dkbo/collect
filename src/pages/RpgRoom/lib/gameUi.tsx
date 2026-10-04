import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Gamepad2, Info, MessageSquare, X } from 'lucide-react'
import { Button, IconBox, IconButton } from '@/components/toybox'

/**
 * 遊戲頁共用零件（pages-spec §1／§4）：MiniGame、GodotGame、RpgRoom、MapDeveloper 共用同一套長相。
 * 只用 toybox token utility，不帶頁面專屬 class，所以可跨頁引用。
 */

/** 頁首（§0）：SectionHeader 版式，標題為 h1 */
export function GamePageHead({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <div className="tb-sechead">
      <div className="tb-sechead__text">
        <span className="tb-sechead__eyebrow">{eyebrow}</span>
        <h1 className="tb-sechead__title">{title}</h1>
        {intro && <p className="max-w-2xl text-body text-ink-muted">{intro}</p>}
      </div>
    </div>
  )
}

/** 畫面內浮鈕（§1）：IconButton 外觀，尺寸例外維持 size-9 */
export function ScreenIconButton({ icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; label: string }) {
  return <IconButton icon={icon} label={label} className={clsx('size-9 [&_svg]:size-4', className)} {...rest} />
}

/** 說明對話框（§4） */
export function GameDialog({
  title,
  icon = <Gamepad2 strokeWidth={2.5} />,
  onClose,
  primaryLabel,
  fixed = false,
  children,
}: {
  title: string
  icon?: ReactNode
  onClose: () => void
  primaryLabel: string
  /** true：整頁遮罩（fixed）；預設疊在遊戲畫面內（absolute） */
  fixed?: boolean
  children: ReactNode
}) {
  return (
    <div className={clsx(fixed ? 'fixed' : 'absolute', 'inset-0 z-40 grid place-items-center bg-inverse/80 p-4')}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-toy-lg border-4 border-line bg-surface-raised p-6 text-ink shadow-hard-l"
      >
        <IconButton icon={<X strokeWidth={2.5} />} label="關閉說明" onClick={onClose} className="absolute top-3 right-3" />
        <div className="flex items-center gap-3 pr-12">
          <IconBox icon={icon} tone="pop" />
          <h3 className="font-display text-heading-m text-ink">{title}</h3>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
        <Button variant="primary" className="w-full" onClick={onClose}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}

const ASCII_ONLY = /^[\x20-\x7E]+$/

/** 按鍵對照列（§4）：右側 kbd 貼紙，含中文改 caption（點陣字無中文字形） */
export function KeyRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b-3 border-line py-2 last:border-b-0">
      <span className="text-label text-ink">{label}</span>
      <kbd
        className={clsx(
          'tb-tag tb-tag--plain shrink text-right whitespace-normal',
          ASCII_ONLY.test(keys) ? 'font-pixel text-pixel-m' : 'text-caption',
        )}
      >
        {keys}
      </kbd>
    </div>
  )
}

/** 資訊提示條（§2 bg-sky） */
export function TipBar({ icon = <Info strokeWidth={2.5} />, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-toy-md border-3 border-line bg-sky px-4 py-3 text-body-s text-on-fill [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0',
        className,
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** 載入浮層（§1／§4）：LOADING 點陣字＋三點逐一亮起，原中文文案放下方 */
export function LoadingOverlay({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx('absolute inset-0 z-50 grid place-items-center bg-inverse', className)}>
      <div className="flex flex-col items-center gap-2 select-none">
        <div className="flex items-baseline font-pixel text-pixel-l text-pop">
          LOADING
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 200}ms` }}>
              .
            </span>
          ))}
        </div>
        <div className="text-label text-on-inverse">{text}</div>
      </div>
    </div>
  )
}

/** 暫停浮層（§4） */
export function PauseOverlay({ hint, onResume, testId }: { hint: string; onResume: () => void; testId?: string }) {
  return (
    <div
      className="absolute inset-0 z-30 grid cursor-pointer place-content-center justify-items-center gap-3 bg-inverse/80 select-none"
      onClick={onResume}
      data-testid={testId}
    >
      <span className="font-pixel text-pixel-xl text-pop">PAUSE</span>
      <span className="text-body-s text-on-inverse-muted">遊戲暫停中・{hint}</span>
    </div>
  )
}

/** 畫面內資訊籤（§4，左上座標） */
export function ScreenInfoTag({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-30 flex flex-col gap-1 rounded-toy-md border-3 border-on-inverse bg-inverse px-3 py-2 font-pixel text-pixel-m text-on-inverse select-none">
      {children}
    </div>
  )
}

/** NPC 對話框（§4）：經典 RPG 反白對話框，位置與尺寸照舊 */
export function ChatBox({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  return (
    <div
      className="absolute bottom-6 left-1/2 z-20 min-h-[96px] w-[90%] -translate-x-1/2 cursor-default rounded-toy-md border-4 border-on-inverse bg-inverse p-4 text-body text-on-inverse shadow-hard-m select-text md:min-h-[128px] md:w-[80%]"
      data-testid="rpg-dialogue-box"
    >
      <div className="mb-2 flex items-center gap-2 border-b-2 border-on-inverse-muted pb-2 text-label text-pop select-none">
        <MessageSquare className="size-4 shrink-0" strokeWidth={2.5} />
        <span>{name}</span>
      </div>
      <div className="min-h-[3.5em] pr-6 text-body">{children}</div>
      <div className="mt-1 flex animate-pulse items-center justify-end gap-2 select-none motion-reduce:animate-none">
        <span className="text-caption text-on-inverse-muted">{hint}</span>
        <span className="font-pixel text-pixel-m text-pop">▼</span>
      </div>
    </div>
  )
}

type Dir = 'up' | 'down' | 'left' | 'right'

const DIRS: { dir: Dir; icon: ReactNode; label: string; cell: string }[] = [
  { dir: 'up', icon: <ArrowUp strokeWidth={2.5} />, label: '上', cell: 'col-start-2 row-start-1' },
  { dir: 'left', icon: <ArrowLeft strokeWidth={2.5} />, label: '左', cell: 'col-start-1 row-start-2' },
  { dir: 'right', icon: <ArrowRight strokeWidth={2.5} />, label: '右', cell: 'col-start-3 row-start-2' },
  { dir: 'down', icon: <ArrowDown strokeWidth={2.5} />, label: '下', cell: 'col-start-2 row-start-3' },
]

/** 控制器面板（§4）：pop 機身＋D-pad＋鍵盤說明＋發射鍵（仿 Handheld A 鍵） */
export function ControllerPad({
  dirProps,
  dirLabel,
  keyboardTitle,
  keyboardLines,
  actionText,
  actionLabel,
  actionHint,
  onAction,
}: {
  /** 每個方向鍵的事件 props（按住／放開派發照各頁原邏輯） */
  dirProps: (dir: Dir) => ButtonHTMLAttributes<HTMLButtonElement>
  /** 方向鍵 aria-label，例：(d) => `向${d}移動` */
  dirLabel: (dirName: string) => string
  keyboardTitle: string
  keyboardLines: string[]
  actionText: string
  actionLabel: string
  actionHint: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-6 rounded-toy-xl border-4 border-line bg-pop p-5 text-on-fill shadow-hard-m sm:flex-row">
      <div className="flex items-center gap-5">
        <div className="grid size-36 shrink-0 grid-cols-3 grid-rows-3 place-items-center gap-1.5 select-none">
          {DIRS.map(({ dir, icon, label, cell }) => (
            <IconButton
              key={dir}
              icon={icon}
              label={dirLabel(label)}
              className={clsx('bg-surface-raised', cell)}
              {...dirProps(dir)}
            />
          ))}
          <span className="col-start-2 row-start-2 font-pixel text-pixel-m whitespace-nowrap">D-PAD</span>
        </div>
        <div className="hidden max-w-60 flex-col gap-1 text-left text-body-s select-none sm:flex">
          <h5 className="text-label">{keyboardTitle}</h5>
          {keyboardLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="h-16 min-w-16 shrink-0 cursor-pointer rounded-toy-pill border-3 px-4 whitespace-nowrap border-on-fill bg-action font-pixel text-pixel-l text-on-fill shadow-hard-s transition-[translate,box-shadow] duration-120 ease-out select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus active:translate-x-[3px] active:translate-y-[3px] active:shadow-none motion-reduce:transition-none"
        >
          {actionText}
        </button>
        <span className="text-caption select-none">{actionHint}</span>
      </div>
    </div>
  )
}
