/** Babylon 遊戲共用純數學工具（無引擎依賴，node 可直接測試） */

/** 角度插值走最短弧，避免 -π/π 邊界打轉 */
export const lerpAngle = (a: number, b: number, t: number): number => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** 位置所在象限（以原點 atan2(x,z) 切四等分；0 = +z 起逆時針向 +x） */
export const quadrantOf = (x: number, z: number): number => {
  const a = (Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2)
  return Math.floor(a / (Math.PI / 2)) % 4
}

/**
 * 象限步進計圈：只認 ±1 步進（防穿場跳格），回傳新的 quarter 數。
 * 由 race 等環道遊戲共用；q 累計通過的象限數，每 4 為一圈。
 */
export const stepQuarters = (q: number, lastQuad: number, quad: number): number => {
  if (quad === (lastQuad + 1) % 4) return q + 1
  if (quad === (lastQuad + 3) % 4) return q - 1
  return q
}
