import { describe, it, expect, beforeEach } from 'vitest'
import { useDirectionsStore } from './useDirectionsStore'

const initialState = useDirectionsStore.getState()

describe('useDirectionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useDirectionsStore.setState({ ...initialState, origin: '', destination: '', latLng: null }, true)
  })

  it('setDirections stores origin/destination and persists destination to localStorage', () => {
    useDirectionsStore.getState().setDirections('台北', '高雄', { lat: 1, lng: 2 })

    expect(useDirectionsStore.getState()).toMatchObject({
      origin: '台北', destination: '高雄', latLng: { lat: 1, lng: 2 },
    })
    expect(JSON.parse(localStorage.getItem('map')!)).toEqual({ origin: '台北', destination: '高雄' })
  })

  it('setDirections keeps the previous latLng when none is provided', () => {
    useDirectionsStore.setState({ latLng: { lat: 9, lng: 9 } })
    useDirectionsStore.getState().setDirections('A', 'B')
    expect(useDirectionsStore.getState().latLng).toEqual({ lat: 9, lng: 9 })
  })

  it('setLatLng only updates the coordinate field', () => {
    useDirectionsStore.getState().setLatLng({ lat: 5, lng: 6 })
    expect(useDirectionsStore.getState().latLng).toEqual({ lat: 5, lng: 6 })
  })

  it('loadSavedMap restores destination from localStorage and resets origin/latLng', () => {
    localStorage.setItem('map', JSON.stringify({ origin: 'stale-origin', destination: '台中' }))
    useDirectionsStore.setState({ origin: 'current', latLng: { lat: 1, lng: 1 } })

    useDirectionsStore.getState().loadSavedMap()

    expect(useDirectionsStore.getState()).toMatchObject({ origin: '', destination: '台中', latLng: null })
  })

  it('loadSavedMap ignores malformed JSON in localStorage without throwing', () => {
    localStorage.setItem('map', 'not-json')
    expect(() => useDirectionsStore.getState().loadSavedMap()).not.toThrow()
    expect(useDirectionsStore.getState().destination).toBe('')
  })
})
