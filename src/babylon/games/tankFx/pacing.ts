/**
 * 固定 tick 下的廣播節拍（純函式）：last 以 interval 累加，平均頻率 = 1000 / interval；
 * 落後超過兩個間隔（分頁暫停等）就夾回 now，不連發補送。
 */
export function paceTick(now: number, last: number, interval: number): { due: boolean; last: number } {
  if (now - last < interval) return { due: false, last }
  return { due: true, last: now - last > interval * 2 ? now : last + interval }
}
