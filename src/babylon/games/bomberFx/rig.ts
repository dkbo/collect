/**
 * 單一 mesh 角色的四肢擺動（純函式）：把 base 頂點中 [start, start+count) 繞 X 軸、以 (y,z) 樞紐旋轉寫進 out。
 * 旋轉方向對齊 Babylon RotationX：y' = y·c − z·s、z' = y·s + z·c。pivot 傳 null 代表法線（只轉不移）。
 */
export function swingRange(
  base: ArrayLike<number>,
  out: Float32Array,
  start: number,
  count: number,
  pivot: { y: number; z: number } | null,
  angle: number
): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const py = pivot?.y ?? 0
  const pz = pivot?.z ?? 0
  for (let v = start; v < start + count; v++) {
    const o = v * 3
    const y = base[o + 1] - py
    const z = base[o + 2] - pz
    out[o] = base[o]
    out[o + 1] = y * c - z * s + py
    out[o + 2] = y * s + z * c + pz
  }
}
