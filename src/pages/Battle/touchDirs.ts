/** 虛擬搖桿派發哪些軸：'xy' 上下左右（預設）、'x' 只派發左右（賽車：油門煞車改用按鈕） */
export type JoyAxes = 'xy' | 'x'

/** 死區，避免輕觸誤判 */
const JOY_DEADZONE = 0.35

/** 搖桿偏移（以半徑正規化，y 往下為正）→ 應按住的方向鍵集合 */
export function joyDirs(nx: number, ny: number, axes: JoyAxes = 'xy'): Set<string> {
  const next = new Set<string>()
  if (axes === 'xy') {
    if (ny < -JOY_DEADZONE) next.add('arrowup')
    else if (ny > JOY_DEADZONE) next.add('arrowdown')
  }
  if (nx < -JOY_DEADZONE) next.add('arrowleft')
  else if (nx > JOY_DEADZONE) next.add('arrowright')
  return next
}
