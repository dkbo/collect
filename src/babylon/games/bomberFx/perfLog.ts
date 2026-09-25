/**
 * AC8 量測行（純函式）：還沒渲染過的取樣（drawCalls=0、fps 非有限值）回 null，
 * 開局第一行不會印出 `drawCalls=0 fps=Infinity` 的雜訊。
 */
export function perfLogLine(drawCalls: number, fps: number): string | null {
  if (drawCalls <= 0 || !Number.isFinite(fps)) return null
  return `[bomber] drawCalls=${drawCalls} fps=${Math.round(fps)}`
}
