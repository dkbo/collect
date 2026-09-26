/**
 * 量測行（純函式，bomber AC8／kitchen AC9）：還沒渲染過的取樣（drawCalls=0、fps 非有限值）回 null，
 * 開局第一行不會印出 `drawCalls=0 fps=Infinity` 的雜訊。tag 為 log 前綴（未給時為 bomber，保留既有行為）。
 */
export function perfLogLine(drawCalls: number, fps: number, tag = 'bomber'): string | null {
  if (drawCalls <= 0 || !Number.isFinite(fps)) return null
  return `[${tag}] drawCalls=${drawCalls} fps=${Math.round(fps)}`
}
