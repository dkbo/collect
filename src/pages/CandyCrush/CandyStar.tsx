import { useId, type CSSProperties } from 'react'

/** A 方案星星：已得為金色漸層＋白描邊，未得為深紫 */
export function CandyStar({
  earned,
  size,
  className,
  style,
  label,
}: {
  earned: boolean
  size: number
  className?: string
  style?: CSSProperties
  label?: string
}) {
  const gradientId = useId()
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {earned && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3a0" />
            <stop offset="55%" stopColor="#ffc21a" />
            <stop offset="100%" stopColor="#f08a00" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2.2l2.95 6.2 6.8.85-5 4.7 1.28 6.75L12 17.4l-6.03 3.3 1.28-6.75-5-4.7 6.8-.85z"
        fill={earned ? `url(#${gradientId})` : '#3a2b7a'}
        stroke={earned ? '#ffffff' : '#5a4aa8'}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}
