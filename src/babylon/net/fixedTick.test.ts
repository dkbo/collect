import { describe, it, expect, vi, afterEach } from 'vitest'
import { createFixedTicker } from './fixedTick'

afterEach(() => {
  vi.useRealTimers()
})

describe('createFixedTicker', () => {
  it('advances one tick per stepMs of elapsed (fake) time', () => {
    vi.useFakeTimers()
    const onTick = vi.fn()
    const ticker = createFixedTicker(10, onTick) // stepMs = 100
    ticker.start()

    vi.advanceTimersByTime(1000)

    expect(ticker.tick).toBe(10)
    expect(onTick).toHaveBeenCalledTimes(10)
    expect(onTick).toHaveBeenNthCalledWith(1, 0, 100)
    expect(onTick).toHaveBeenNthCalledWith(10, 9, 100)
  })

  it('reports running only between start() and stop()', () => {
    vi.useFakeTimers()
    const ticker = createFixedTicker(10, () => {})
    expect(ticker.running).toBe(false)
    ticker.start()
    expect(ticker.running).toBe(true)
    ticker.stop()
    expect(ticker.running).toBe(false)
  })

  it('start() is idempotent and does not spawn a second timer', () => {
    vi.useFakeTimers()
    const onTick = vi.fn()
    const ticker = createFixedTicker(10, onTick)
    ticker.start()
    ticker.start()

    vi.advanceTimersByTime(1000)

    // 若重複建立了第二個 timer，1000ms 內會產生遠多於 10 次 tick
    expect(onTick).toHaveBeenCalledTimes(10)
  })

  it('stop() halts further ticks', () => {
    vi.useFakeTimers()
    const onTick = vi.fn()
    const ticker = createFixedTicker(10, onTick)
    ticker.start()
    vi.advanceTimersByTime(500)
    expect(ticker.tick).toBe(5)

    ticker.stop()
    vi.advanceTimersByTime(500)
    expect(ticker.tick).toBe(5)
  })

  it('caps the catch-up burst after a long stall instead of firing hundreds of ticks', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const onTick = vi.fn()
    const ticker = createFixedTicker(10, onTick) // stepMs = 100
    ticker.start() // last = now = 0

    // 模擬分頁被背景節流：真實時間跳了 5 秒，但只觸發一次 pump（poll interval 到期）
    now = 5000
    vi.advanceTimersByTime(50) // 觸發下一次排定的 pump（interval = stepMs/2 = 50ms）

    // MAX_ACCUM_MS = 250，250/100 = 2.5 → 只補 2 tick，遠少於「理論上」的 50 tick
    expect(ticker.tick).toBe(2)
  })
})
