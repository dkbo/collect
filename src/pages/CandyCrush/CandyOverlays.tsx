import { ArrowRight, RotateCcw, X } from 'lucide-react'
import { useCandyStore } from '@/store/useCandyStore'
import { useCountUp } from '@/lib/useCountUp'
import { CandyStar } from '@/pages/CandyCrush/CandyStar'
import { resultSubtitle } from '@/pages/CandyCrush/candyHud'

/** 結算星星尺寸：中間那顆較大且高 22px */
const RESULT_STARS = [
  { star: 1, size: 64, lift: 0, sizeClass: 'size-12 sm:size-16' },
  { star: 2, size: 84, lift: 22, sizeClass: 'size-16 sm:size-[84px]' },
  { star: 3, size: 64, lift: 0, sizeClass: 'size-12 sm:size-16' },
]

/** 結算（勝／敗）：緞帶、星星依序彈出、分數 0.8s 滾動 */
export function ResultDialog({
  maxLevel,
  onStart,
}: {
  maxLevel: number
  onStart: (level: number) => void
}) {
  const { won, endLevel, endScore, endStars, target } = useCandyStore()
  const { value: shownScore, ref: scoreRef } = useCountUp(endScore, 800)
  const isLastLevel = won && endLevel >= maxLevel

  return (
    <div className="candy-mask animate-fade-in" data-testid="candy-result">
      <div className={`candy-dialog ${won ? '' : 'candy-dialog-lose'}`}>
        <h2 className={`candy-ribbon ${won ? '' : 'candy-ribbon-lose'}`}>
          {won ? `第 ${endLevel} 關 通關！` : '步數用完 挑戰失敗'}
        </h2>

        <div className="flex items-end justify-center gap-4" data-testid="result-stars">
          {RESULT_STARS.map(({ star, size, lift, sizeClass }, i) => {
            const earned = won && endStars >= star
            return (
              <CandyStar
                key={star}
                earned={earned}
                size={size}
                className={`${sizeClass} ${earned ? 'candy-star-pop' : ''}`}
                style={{ marginBottom: lift, animationDelay: earned ? `${i * 0.2}s` : undefined }}
                label={earned ? `獲得第 ${star} 顆星` : `未獲得第 ${star} 顆星`}
              />
            )
          })}
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[15px] font-bold text-[#a0668a]">得分</span>
          <span
            ref={scoreRef}
            className="candy-num text-[40px] sm:text-[52px] leading-tight text-[#7a1d52]"
            data-testid="result-score"
          >
            {shownScore.toLocaleString()}
          </span>
        </div>

        <p className="text-[13px] text-[#8a6a9a]">{resultSubtitle(endScore, target, won ? endStars : 0)}</p>

        {isLastLevel && <div className="font-black text-[#f08a00]">恭喜全部通關！</div>}

        <div className="mt-1 flex flex-wrap justify-center gap-2 sm:gap-3">
          {won ? (
            <>
              <button
                type="button"
                className="candy-btn-secondary"
                onClick={() => onStart(endLevel)}
                data-testid="result-replay"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                重玩本關
              </button>
              {isLastLevel ? (
                <button type="button" className="candy-btn" onClick={() => onStart(1)} data-testid="result-restart">
                  從第 1 關再玩
                </button>
              ) : (
                <button
                  type="button"
                  className="candy-btn"
                  onClick={() => onStart(endLevel + 1)}
                  data-testid="result-next"
                >
                  下一關
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <button type="button" className="candy-btn" onClick={() => onStart(endLevel)} data-testid="result-replay">
              <RotateCcw className="size-4" aria-hidden="true" />
              重玩本關
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 暫停：同一層遮罩，中央關卡牌樣式 */
export function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="candy-mask animate-fade-in cursor-pointer gap-3" onClick={onResume} data-testid="candy-pause-overlay">
      <div className="candy-level">
        <span className="text-[28px] font-black text-white [text-shadow:0_3px_0_#a3125e]">暫停中</span>
      </div>
      <span className="text-[13px] text-white/70">點擊畫面或按 P 鍵恢復</span>
    </div>
  )
}

/** 操作說明：與結算卡同一個元件；快捷鍵內容維持現狀 */
export function InstructionsDialog({ isTouchDevice, onClose }: { isTouchDevice: boolean; onClose: () => void }) {
  const rows = isTouchDevice
    ? [
        ['交換糖果', '點選兩顆相鄰糖果，或滑動拖曳'],
        ['暫停遊戲', '畫面右上 ⏸ 按鈕'],
        ['開啟本選單', '畫面右上 ? 按鈕'],
      ]
    : [
        ['交換糖果', '點選兩顆相鄰糖果，或拖曳'],
        ['暫停遊戲', 'P 鍵或右上 ⏸ 按鈕'],
        ['開啟本選單', 'ESC 鍵'],
      ]

  return (
    <div className="candy-mask animate-fade-in candy-mask-top" data-testid="candy-instructions">
      <div className="candy-dialog">
        <h3 className="candy-ribbon">操作說明</h3>
        <button
          type="button"
          className="absolute top-8 right-2 sm:top-10 sm:right-3 rounded-full p-1.5 text-[#a0668a] hover:bg-white/70 hover:text-[#7a1d52] cursor-pointer"
          onClick={onClose}
          aria-label="關閉說明"
        >
          <X className="size-5" />
        </button>

        <div className="w-full space-y-2.5 text-sm leading-relaxed">
          {rows.map(([label, keys]) => (
            <div key={label} className="candy-card-light">
              <span className="shrink-0 font-bold text-[#7a1d52]">{label}</span>
              <span className="candy-kbd">{keys}</span>
            </div>
          ))}
          <div className="rounded-xl bg-white/70 p-3 text-left text-xs leading-normal text-[#7a1d52]">
            <span className="mb-1 block font-bold">目標</span>
            在步數限制內達到目標分數，消除 3 顆以上相同顏色的糖果得分。特殊糖果可觸發更強力的消除！
          </div>
        </div>

        <button type="button" className="candy-btn mt-2 w-full" onClick={onClose}>
          開始遊戲
        </button>
      </div>
    </div>
  )
}
