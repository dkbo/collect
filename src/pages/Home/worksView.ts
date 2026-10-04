import { WORKS, type Work, type WorkKind } from '@/pages/Home/works'

export type WorksFilter = 'all' | WorkKind

export interface NumberedWork {
  work: Work
  /** 卡帶編號：依 WORKS 順序固定，篩選不重排 */
  no: string
}

const NUMBERED: readonly NumberedWork[] = WORKS.map((work, i) => ({ work, no: String(i + 1).padStart(2, '0') }))

/** 作品區：featured 作品走 FeatureCard（篩到工具時隱藏），其餘走 CartridgeCard grid */
export function selectWorks(filter: WorksFilter): { featured?: NumberedWork; cartridges: NumberedWork[] } {
  const visible = NUMBERED.filter((n) => filter === 'all' || n.work.kind === filter)
  return {
    featured: visible.find((n) => n.work.variant === 'featured'),
    cartridges: visible.filter((n) => n.work.variant !== 'featured'),
  }
}
