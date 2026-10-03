import { describe, it, expect } from 'vitest'
import { CELL, GRID_H, GRID_W, cellToWorld, inGrid, tankBlocked, tankMoveBlocked, worldToCell } from '@/babylon/games/tankFx/grid'

describe('grid — 格與世界座標', () => {
  it('cellToWorld／worldToCell 互逆，場地常數不變', () => {
    expect([CELL, GRID_W, GRID_H]).toEqual([2, 16, 16])
    for (let c = 0; c < GRID_W; c++) expect(worldToCell(cellToWorld(c, GRID_W), GRID_W)).toBe(c)
  })

  it('inGrid 只收 0..15', () => {
    expect(inGrid(0, 15)).toBe(true)
    expect(inGrid(-1, 0)).toBe(false)
    expect(inGrid(0, 16)).toBe(false)
  })
})

describe('tankBlocked — 坦克佔位（半徑 0.5 四角）', () => {
  const none = () => false
  it('格中心、四周空曠不擋', () => {
    expect(tankBlocked(cellToWorld(4, GRID_W), cellToWorld(4, GRID_H), none)).toBe(false)
  })

  it('任一角落進牆格即擋', () => {
    const wall = (cx: number, cy: number) => cx === 5 && cy === 4
    // 格 4 中心 x=-7，右緣 -6；坦克中心往右 0.6 → 右角落 -5.9 落入格 5
    expect(tankBlocked(cellToWorld(4, GRID_W) + 0.6, cellToWorld(4, GRID_H), wall)).toBe(true)
  })

  it('出場外即擋', () => {
    expect(tankBlocked(cellToWorld(0, GRID_W) - 0.6, 0, none)).toBe(true)
  })
})

describe('tankMoveBlocked — 只擋新增碰到（或更深入）的阻擋格', () => {
  const only = (...cells: [number, number][]) => (cx: number, cy: number) =>
    cells.some(([x, y]) => x === cx && y === cy)
  const wall = only([3, 2])
  // 中心在 (2,2) 格、距右界 0.2：右側兩角已落在剛落下的 (3,2) 牆格內
  const x0 = cellToWorld(2, GRID_W) + CELL / 2 - 0.2
  const z0 = cellToWorld(2, GRID_H)

  it('重現：舊判定下四向都動不了', () => {
    const stuck = [
      [-0.15, 0],
      [0.15, 0],
      [0, -0.15],
      [0, 0.15],
    ].every(([dx, dz]) => tankBlocked(x0 + dx, z0 + dz, wall))
    expect(stuck).toBe(true)
  })

  it('擦到落牆格的坦克可往外、沿牆移動', () => {
    expect(tankMoveBlocked(x0, z0, x0 - 0.15, z0, wall)).toBe(false)
    expect(tankMoveBlocked(x0, z0, x0, z0 + 0.15, wall)).toBe(false)
    expect(tankMoveBlocked(x0, z0, x0, z0 - 0.15, wall)).toBe(false)
  })

  it('不能往已擦到的牆格更深處走', () => {
    expect(tankMoveBlocked(x0, z0, x0 + 0.15, z0, wall)).toBe(true)
  })

  it('空曠處碰到新的牆格照樣擋', () => {
    const x = cellToWorld(2, GRID_W) + CELL / 2 - 0.55
    expect(tankMoveBlocked(x, z0, x + 0.1, z0, wall)).toBe(true)
    expect(tankMoveBlocked(x, z0, x - 0.1, z0, wall)).toBe(false)
  })

  it('出場外照樣擋', () => {
    const x = cellToWorld(0, GRID_W) - CELL / 2 + 0.55
    expect(tankMoveBlocked(x, z0, x - 0.1, z0, () => false)).toBe(true)
  })
})
