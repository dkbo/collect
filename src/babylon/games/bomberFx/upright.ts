/**
 * 俯角透視的起伏位移補償（純函式）：相機從高處往下看、fov 又寬，畫面邊角的直立物會沿「離畫面中心」的
 * 放射方向往外倒（近側兩個出生角的角色看起來像橫躺）。相機不能動，所以讓角色依所在位置微傾：
 * 把世界 +Y 投影到「視線 × 畫面上方」決定的平面上，得到的上軸在畫面上會是直立的，且是離 +Y 最近的那一個。
 */

type V3 = readonly [number, number, number]

const MAX_LEAN = (30 * Math.PI) / 180

export interface UprightOptions {
  /** 側傾上限（與 +Y 的夾角），預設 30° */
  maxLean?: number
  /** 再往後仰（遠離相機）的角度：在同一平面內旋轉，畫面上仍直立，只是多露出正面 */
  backTilt?: number
}

/** 角色在 pos 時該用的上軸（單位向量）；cam 為相機位置、camUp 為畫面上方的世界方向 */
export function uprightAxis(pos: V3, cam: V3, camUp: V3, opts: UprightOptions = {}): [number, number, number] {
  const maxLean = opts.maxLean ?? MAX_LEAN
  const d = [cam[0] - pos[0], cam[1] - pos[1], cam[2] - pos[2]]
  const n = [d[1] * camUp[2] - d[2] * camUp[1], d[2] * camUp[0] - d[0] * camUp[2], d[0] * camUp[1] - d[1] * camUp[0]]
  const nl = Math.hypot(n[0], n[1], n[2])
  if (nl < 1e-9) return [0, 1, 0]
  const k = n[1] / (nl * nl) // (Y·n)/|n|²
  let x = -k * n[0]
  let y = 1 - k * n[1]
  let z = -k * n[2]
  const l = Math.hypot(x, y, z)
  if (l < 1e-9) return [0, 1, 0]
  x /= l
  y /= l
  z /= l
  // 夾住傾角：保留方向、把與 +Y 的夾角限制在 maxLean 內
  if (Math.acos(Math.min(1, y)) > maxLean) {
    const h = Math.hypot(x, z)
    const s = Math.sin(maxLean) / h
    x *= s
    z *= s
    y = Math.cos(maxLean)
  }
  const t = opts.backTilt ?? 0
  if (t === 0) return [x, y, z]
  // 繞平面法線 n̂ 旋轉 t（Rodrigues，a ⟂ n̂）；兩個方向取離相機較遠的那個
  const m = [n[0] / nl, n[1] / nl, n[2] / nl]
  const c = [m[1] * z - m[2] * y, m[2] * x - m[0] * z, m[0] * y - m[1] * x]
  const rot = (sgn: number): [number, number, number] => [
    x * Math.cos(t) + sgn * c[0] * Math.sin(t),
    y * Math.cos(t) + sgn * c[1] * Math.sin(t),
    z * Math.cos(t) + sgn * c[2] * Math.sin(t),
  ]
  const a = rot(1)
  const b = rot(-1)
  const toward = (v: number[]) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2]
  return toward(a) < toward(b) ? a : b
}
