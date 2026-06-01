import { create } from 'zustand'

export interface LatLng {
  lat: number
  lng: number
}

interface DirectionsStore {
  origin: string
  destination: string
  latLng: LatLng | null
  
  // Actions
  setDirections: (origin: string, destination: string, latLng?: LatLng | null) => void
  setLatLng: (latLng: LatLng) => void
  loadSavedMap: () => void
}

const loadInitialState = () => {
  const state = {
    origin: '',
    destination: '',
    latLng: null as LatLng | null,
  }
  
  try {
    const saved = localStorage.getItem('map')
    if (saved) {
      const parsed = JSON.parse(saved)
      state.destination = parsed.destination || ''
    }
  } catch (e) {
    console.error('Failed to load map state from localStorage', e)
  }
  
  return state
}

export const useDirectionsStore = create<DirectionsStore>((set, get) => ({
  ...loadInitialState(),

  setDirections: (origin, destination, latLng = null) => {
    try {
      localStorage.setItem('map', JSON.stringify({ origin, destination }))
    } catch (e) {
      console.error('Failed to save map state to localStorage', e)
    }
    set({ origin, destination, latLng: latLng || get().latLng })
  },

  setLatLng: (latLng) => set({ latLng }),

  loadSavedMap: () => {
    const state = loadInitialState()
    set(state)
  },
}))

export default useDirectionsStore
