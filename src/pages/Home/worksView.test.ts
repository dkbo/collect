import { describe, expect, it } from 'vitest'
import { selectWorks } from '@/pages/Home/worksView'

describe('selectWorks', () => {
  it('全部：featured 為 battle，其餘 8 張卡帶編號 02–09', () => {
    const view = selectWorks('all')
    expect(view.featured?.work.id).toBe('battle')
    expect(view.featured?.no).toBe('01')
    expect(view.cartridges.map((c) => c.no)).toEqual(['02', '03', '04', '05', '06', '07', '08', '09'])
  })

  it('遊戲：保留 featured，只列 4 張遊戲卡帶且編號不重排', () => {
    const view = selectWorks('game')
    expect(view.featured?.work.id).toBe('battle')
    expect(view.cartridges.map((c) => c.work.kind)).toEqual(['game', 'game', 'game', 'game'])
    expect(view.cartridges.map((c) => c.no)).toEqual(['02', '03', '04', '05'])
  })

  it('工具：隱藏 featured，只列 4 張工具卡帶', () => {
    const view = selectWorks('tool')
    expect(view.featured).toBeUndefined()
    expect(view.cartridges.map((c) => c.work.id)).toEqual(['search', 'todos', 'directions', 'mapdev'])
    expect(view.cartridges.map((c) => c.no)).toEqual(['06', '07', '08', '09'])
  })
})
