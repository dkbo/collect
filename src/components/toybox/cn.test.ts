import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'
import { tbCn } from '@/components/toybox/cn'

describe('tbCn（認得 toybox token 的 tailwind-merge）', () => {
  it('字級 token 與文字色並存', () => {
    expect(tbCn('text-heading-m text-ink')).toBe('text-heading-m text-ink')
    expect(tbCn('text-button-s text-slate-100')).toBe('text-button-s text-slate-100')
  })

  it('硬陰影是陰影尺寸、不是陰影色', () => {
    expect(tbCn('shadow-hard-s shadow-destructive')).toBe('shadow-hard-s shadow-destructive')
    expect(tbCn('shadow-hard-s shadow-md')).toBe('shadow-md')
  })

  it('toybox 圓角互相覆寫', () => {
    expect(tbCn('rounded-toy-md rounded-toy-sm')).toBe('rounded-toy-sm')
    expect(tbCn('rounded-toy-md rounded-xl')).toBe('rounded-xl')
  })

  it('字族與 max-w-site 也認得', () => {
    expect(tbCn('font-display font-body')).toBe('font-body')
    expect(tbCn('max-w-site max-w-4xl')).toBe('max-w-4xl')
  })

  it('lib 的 cn 與 tbCn 同一套，不再吃掉字級 token', () => {
    expect(cn('text-heading-m text-ink')).toBe('text-heading-m text-ink')
    expect(cn('shadow-hard-s shadow-md')).toBe('shadow-md')
    expect(cn('px-2 px-4')).toBe('px-4')
  })
})
