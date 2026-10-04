// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Handheld } from '@/components/toybox/Handheld'

// 讓 React 知道這是測試環境（act 不再警告）
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const IMAGES = ['/a.webp', '/b.webp', '/c.webp']

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = (props: Parameters<typeof Handheld>[0]) => act(() => root.render(createElement(Handheld, props)))
const img = () => host.querySelector('img')?.getAttribute('src')
const pressB = () => act(() => (host.querySelector('[aria-label="B 鍵"]') as HTMLButtonElement).click())

describe('Handheld B 鍵', () => {
  it('沒傳 onB 時也換下一張', () => {
    render({ images: IMAGES, autoPlayMs: 0 })
    expect(img()).toBe('/a.webp')
    pressB()
    expect(img()).toBe('/b.webp')
    pressB()
    pressB()
    expect(img()).toBe('/a.webp')
  })

  it('有 onB 時先換張再帶新的張數', () => {
    const onB = vi.fn()
    render({ images: IMAGES, autoPlayMs: 0, onB })
    pressB()
    expect(img()).toBe('/b.webp')
    expect(onB).toHaveBeenCalledWith(1)
  })

  it('只有一張時不換、仍帶 0', () => {
    const onB = vi.fn()
    render({ image: '/a.webp', autoPlayMs: 0, onB })
    pressB()
    expect(img()).toBe('/a.webp')
    expect(onB).toHaveBeenCalledWith(0)
  })
})
