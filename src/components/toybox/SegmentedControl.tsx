import { useState } from 'react'
import { clsx } from 'clsx'

export interface SegmentedControlProps {
  /** testId 會掛成該選項的 data-testid */
  options: { value: string; label: string; testId?: string }[]
  /** 受控值；不傳則用 defaultValue（預設第一個選項）自管 */
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** 群組的 aria-label */
  label: string
  className?: string
}

export function SegmentedControl({ options, value, defaultValue, onChange, label, className }: SegmentedControlProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value)
  const current = value ?? inner

  return (
    <div className={clsx('tb-seg', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="tb-seg__opt"
          aria-pressed={o.value === current}
          data-testid={o.testId}
          onClick={() => {
            setInner(o.value)
            onChange?.(o.value)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
