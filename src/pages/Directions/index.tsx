/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Compass, MapPin, Navigation, Info, X } from 'lucide-react'
import { useDirectionsStore } from '@/store/useDirectionsStore'
import type { LatLng } from '@/store/useDirectionsStore'
import { useThemeStore } from '@/store/useThemeStore'
import { IconButton } from '@/components/toybox'
import '@/pages/Directions/Directions.css'


// Dynamic Google Maps Script Loader
const loadGoogleMapsScript = (callback: () => void) => {
  if (typeof window === 'undefined') return

  if ((window as any).google && (window as any).google.maps) {
    callback()
    return
  }

  const existingScript = document.getElementById('google-maps-script')
  if (existingScript) {
    existingScript.addEventListener('load', callback)
    return
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('缺少 VITE_GOOGLE_MAPS_API_KEY，未載入 Google Maps（請在 .env.local 設定）')
    return
  }

  const script = document.createElement('script')
  script.id = 'google-maps-script'
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.defer = true

  script.addEventListener('load', callback)
  document.head.appendChild(script)
}

// Custom Overlay Generator (matching overlays.jsx)
function getCustomOverlayClass(google: any) {
  return class CustomOverlay extends google.maps.OverlayView {
    bounds: any
    image: string
    message: string
    mapInstance: any
    div: HTMLDivElement | null = null
    dialog: HTMLDivElement | null = null
    img: HTMLImageElement | null = null

    constructor(bounds: any, image: string, message: string, map: any) {
      super()
      this.bounds = bounds
      this.image = image
      this.message = message
      this.mapInstance = map
      this.setMap(map)
    }

    onAdd() {
      const innerHTML = `
        <div class="geoDialog dir-bubble">
          ${this.message}
        </div>
        <div class="geoImg dir-marker" role="button" tabindex="0" aria-label="查看玩家資訊">
          <img src="${this.image}" class="size-full rounded-full object-cover" alt="User" />
        </div>
      `
      const div = document.createElement('div')
      div.className = 'absolute z-40'
      div.innerHTML = innerHTML

      this.div = div
      this.dialog = div.querySelector('.geoDialog')
      this.img = div.querySelector('.geoImg img')

      const imgWrapper = div.querySelector('.geoImg')
      if (imgWrapper) {
        imgWrapper.addEventListener('click', this.toggleDialog, false)
        imgWrapper.addEventListener('keydown', (e: any) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this.toggleDialog(e)
          }
        }, false)
      }

      const panes = this.getPanes()
      panes.overlayImage.appendChild(div)
    }

    toggleDialog = (e: Event) => {
      e.stopPropagation()
      if (this.dialog) {
        const isShown = this.dialog.classList.contains('opacity-100')
        if (isShown) {
          this.dialog.classList.remove('opacity-100', 'pointer-events-auto')
          this.dialog.classList.add('opacity-0', 'pointer-events-none')
        } else {
          this.dialog.classList.remove('opacity-0', 'pointer-events-none')
          this.dialog.classList.add('opacity-100', 'pointer-events-auto')
        }
      }
    }

    draw() {
      if (!this.div) return
      const overlayProjection = this.getProjection()
      const sw = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest())
      const ne = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast())

      this.div.style.left = `${sw.x - 22}px`
      this.div.style.top = `${ne.y - 22}px`
    }

    onRemove() {
      if (this.div) {
        const imgWrapper = this.div.querySelector('.geoImg')
        if (imgWrapper) {
          imgWrapper.removeEventListener('click', this.toggleDialog)
        }
        if (this.div.parentNode) {
          this.div.parentNode.removeChild(this.div)
        }
        this.div = null
      }
    }

    onSet(bounds: any, image: string, message: string) {
      this.bounds = bounds
      this.image = image
      this.message = message
      if (this.dialog) this.dialog.innerHTML = message
      if (this.img) this.img.src = image
      this.draw()
    }
  }
}

// Simulated active players
interface SimulatedPlayer {
  uid: string
  displayName: string
  photoURL: string
  latOffset: number
  lngOffset: number
  message: string
  timeAgoText: string
}

const simulatedPlayers: SimulatedPlayer[] = [
  {
    uid: 'alice_sim',
    displayName: 'Alice',
    photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice',
    latOffset: 0.003,
    lngOffset: 0.003,
    message: `<div class="dir-bubble__name">Alice</div><p>哈囉！我正在附近的星巴克喝咖啡！☕</p><div class="dir-bubble__time">1 分鐘前</div>`,
    timeAgoText: '1 分鐘前',
  },
  {
    uid: 'bob_sim',
    displayName: 'Bob',
    photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bob',
    latOffset: -0.002,
    lngOffset: -0.004,
    message: `<div class="dir-bubble__name">Bob</div><p>中壢夜市今天有開，快來吃大腸包小腸！🌭</p><div class="dir-bubble__time">3 分鐘前</div>`,
    timeAgoText: '3 分鐘前',
  },
  {
    uid: 'dkbo_sim',
    displayName: 'DKBO',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=dkbo',
    latOffset: 0.001,
    lngOffset: -0.002,
    message: `<div class="dir-bubble__name">DKBO (作者)</div><p>歡迎來到我的地圖導覽作品！這是用 React 19 與 Tailwind 重塑的頁面。🎨</p><div class="dir-bubble__time">剛剛</div>`,
    timeAgoText: '剛剛',
  },
]

const lightMapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
]

const darkMapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] }, // slate-800
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] }, // slate-900
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] }, // slate-400
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }], // slate-300
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }], // slate-700
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#475569' }], // slate-600
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }], // slate-900
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0f172a' }],
  },
]

const MOCK_ROUTE_STEPS = [
  "沿主幹道向東北方向行駛，前行 500 公尺。",
  "於下一個十字路口向右轉，進入中山路，前行 1.2 公里。",
  "持續直行，經過中油加油站後，靠左側車道行駛。",
  "於環島處選擇第二出口，進入復興路，前行 800 公尺。",
  "抵達目的地，目的地即在您的右側，旅途愉快！"
] as const

export function DirectionsPage() {
  const { origin, destination, latLng, setDirections, setLatLng } = useDirectionsStore()
  const { theme } = useThemeStore()
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showTextFallback, setShowTextFallback] = useState(false)

  useEffect(() => {
    if (isMapLoaded) {
      const handle = requestAnimationFrame(() => {
        setShowTextFallback(false)
      })
      return () => cancelAnimationFrame(handle)
    }
    const timer = setTimeout(() => {
      setShowTextFallback(true)
    }, 4500)
    return () => clearTimeout(timer)
  }, [isMapLoaded])
  
  const mapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const originInputRef = useRef<HTMLInputElement>(null)
  const destInputRef = useRef<HTMLInputElement>(null)

  const googleMapInstanceRef = useRef<any>(null)
  const directionsServiceRef = useRef<any>(null)
  const directionsDisplayRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlayMarkersRef = useRef<{ [key: string]: any }>({})

  // Load Google Maps Script
  useEffect(() => {
    loadGoogleMapsScript(() => {
      setIsMapLoaded(true)
    })
  }, [])

  // Dynamic Theme Synchronization for Google Maps
  useEffect(() => {
    if (googleMapInstanceRef.current && isMapLoaded) {
      googleMapInstanceRef.current.setOptions({
        styles: theme === 'dark' ? darkMapStyles : lightMapStyles,
      })
    }
  }, [theme, isMapLoaded])

  // Geocoding and default location logic (getCurrentPosition)
  const resolveCurrentLocation = (google: any): Promise<{ address: string; pos: LatLng }> => {
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder()
      
      const successCallback = (position: GeolocationPosition) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const pos = { lat, lng }
        
        geocoder.geocode({ location: pos }, (results: any, status: string) => {
          if (status === 'OK' && results[0]) {
            resolve({ address: results[0].formatted_address, pos })
          } else {
            resolve({ address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, pos })
          }
        })
      }

      const errorCallback = (error?: GeolocationPositionError) => {
        let msg = "已使用預設中心點（桃園中壢）。您可以手動輸入出發地。"
        if (error) {
          if (error.code === error.PERMISSION_DENIED) {
            msg = "定位授權遭拒。已將起點設為預設位置（桃園中壢），您可手動輸入起點。"
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = "無法獲取您當前的位置。已自動預設為桃園中壢，您可手動輸入起點。"
          } else if (error.code === error.TIMEOUT) {
            msg = "定位請求超時。已使用預設起點（桃園中壢），您可手動輸入起點。"
          }
        }
        setErrorMessage(msg)
        // Fallback to Taoyuan default coordinate
        const pos = { lat: 24.962, lng: 121.218 }
        geocoder.geocode({ location: pos }, (results: any, status: string) => {
          if (status === 'OK' && results[0]) {
            resolve({ address: results[0].formatted_address, pos })
          } else {
            resolve({ address: '桃園中壢', pos })
          }
        })
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
          timeout: 5000,
        })
      } else {
        errorCallback()
      }
    })
  }

  // Initialize Map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return
    const google = (window as any).google

    const mapOptions = {
      zoom: 15,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: theme === 'dark' ? darkMapStyles : lightMapStyles,
    }

    const map = new google.maps.Map(mapRef.current, mapOptions)
    googleMapInstanceRef.current = map

    const directionsService = new google.maps.DirectionsService()
    const directionsDisplay = new google.maps.DirectionsRenderer()
    directionsDisplay.setMap(map)
    if (panelRef.current) {
      directionsDisplay.setPanel(panelRef.current)
    }

    directionsServiceRef.current = directionsService
    directionsDisplayRef.current = directionsDisplay

    // Auto-resolve initial location if origin is blank
    if (!origin) {
      resolveCurrentLocation(google).then(({ address, pos }) => {
        setLatLng(pos)
        setDirections(address, destination, pos)
      })
    } else {
      // If we already have coordinates from store
      if (latLng) {
        map.setCenter(latLng)
      }
    }

    // Set search box auto-completes
    if (originInputRef.current && destInputRef.current) {
      const originBox = new google.maps.places.SearchBox(originInputRef.current)
      const destBox = new google.maps.places.SearchBox(destInputRef.current)

      originBox.addListener('places_changed', () => {
        const places = originBox.getPlaces()
        if (places && places[0]) {
          const address = places[0].formatted_address || places[0].name || ''
          const location = places[0].geometry.location
          const pos = { lat: location.lat(), lng: location.lng() }
          setDirections(address, destination, pos)
        }
      })

      destBox.addListener('places_changed', () => {
        const places = destBox.getPlaces()
        if (places && places[0]) {
          const address = places[0].formatted_address || places[0].name || ''
          setDirections(origin, address)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded])

  // Calculate Routes and markers
  const calculateRoute = useCallback(() => {
    if (!isMapLoaded || !googleMapInstanceRef.current) return
    const google = (window as any).google
    const map = googleMapInstanceRef.current

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    // Clear old custom overlays
    Object.keys(overlayMarkersRef.current).forEach((key) => {
      overlayMarkersRef.current[key].setMap(null)
    })
    overlayMarkersRef.current = {}

    if (origin && destination) {
      // Route Planning Mode
      const request = {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      }

      directionsServiceRef.current.route(request, (response: any, status: string) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsDisplayRef.current.setDirections(response)
          setShowPanel(true)
          setErrorMessage(null)
        } else {
          setErrorMessage('無法規劃此路線，請確認地址是否正確。')
          setShowPanel(false)
        }
      })
    } else if (latLng) {
      // Single Point Marker Mode (Centering on initial location or custom origin)
      setTimeout(() => {
        setShowPanel(false)
        setErrorMessage(null)
      }, 0)
      directionsDisplayRef.current.set('directions', null)
      
      const googleLatLng = new google.maps.LatLng(latLng.lat, latLng.lng)
      map.setCenter(googleLatLng)
      map.setZoom(16)

      const marker = new google.maps.Marker({
        map,
        position: googleLatLng,
        animation: google.maps.Animation.DROP,
        title: origin || '您在此處',
      })
      markersRef.current.push(marker)

      const infoWindow = new google.maps.InfoWindow({
        content: `<div class="dir-infowin">${origin || '我的位置'}</div>`,
      })
      infoWindow.open(map, marker)

      // Render Simulated player overlays near this location
      const CustomOverlay = getCustomOverlayClass(google)
      simulatedPlayers.forEach((player) => {
        const playerLatLng = new google.maps.LatLng(
          latLng.lat + player.latOffset,
          latLng.lng + player.lngOffset
        )
        const bounds = new google.maps.LatLngBounds(playerLatLng)
        
        const overlay = new CustomOverlay(
          bounds,
          player.photoURL,
          player.message,
          map
        )
        overlayMarkersRef.current[player.uid] = overlay
      })
    }
  }, [origin, destination, latLng, isMapLoaded])

  // Recalculate whenever inputs or coordinates update
  useEffect(() => {
    if (isMapLoaded) {
      calculateRoute()
    }
  }, [calculateRoute, isMapLoaded])

  // Trigger search on inputs change with debounce
  const [localOrigin, setLocalOrigin] = useState(origin)
  const [localDest, setLocalDest] = useState(destination)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalOrigin(origin)
    }, 0)
    return () => clearTimeout(timer)
  }, [origin])

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalDest(destination)
    }, 0)
    return () => clearTimeout(timer)
  }, [destination])

  // Handle enter key searches
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isOrigin: boolean) => {
    if (e.key === 'Enter') {
      const google = (window as any).google
      if (!google) return

      const geocoder = new google.maps.Geocoder()
      const val = isOrigin ? localOrigin : localDest
      
      if (!val.trim()) return

      geocoder.geocode({ address: val }, (results: any, status: string) => {
        if (status === 'OK' && results[0]) {
          const pos = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          }
          if (isOrigin) {
            setLatLng(pos)
            setDirections(results[0].formatted_address, destination, pos)
          } else {
            setDirections(origin, results[0].formatted_address)
          }
        } else {
          setErrorMessage('無法定位該地址')
        }
      })
    }
  }

  return (
    <div className="tb-container dir-page" data-testid="page-directions">
      <header className="tb-sechead">
        <div className="tb-sechead__text">
          <span className="tb-sechead__eyebrow">— ROUTE PLANNER —</span>
          <h1 className="tb-sechead__title">地圖導覽</h1>
        </div>
      </header>

      <div className="dir-map">
        {/* Map Rendering Div or Text-Only Fallback */}
        {showTextFallback ? (
          <div className="dir-fallback">
            <Info className="size-10 text-pop" strokeWidth={2.5} aria-hidden="true" />
            <h3 className="dir-fallback__title">地圖服務載入逾時</h3>
            <p className="dir-fallback__desc">
              由於無法正常載入 Google Maps API，已自動切換為「文字路線導覽模式」。您仍可於上方輸入起迄點進行模擬規劃。
            </p>
            {origin && destination && (
              <div className="dir-route">
                <div className="dir-route__label">預估路程：約 3.8 公里 (8 分鐘)</div>
                <div className="dir-route__label">文字行車指引（模擬）：</div>
                <ul className="dir-route__steps">
                  {MOCK_ROUTE_STEPS.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div id="map" ref={mapRef} className="absolute inset-0 z-0 size-full" />
        )}

        {/* Floating Control Box */}
        <div id="mapControl" className="dir-control">
          <div className="dir-field">
            <Compass className="dir-field__icon" strokeWidth={2.5} aria-hidden="true" />
            <input
              ref={originInputRef}
              className="tb-input dir-input"
              type="text"
              value={localOrigin}
              onChange={(e) => setLocalOrigin(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, true)}
              placeholder="起點（可輸入位址，或使用當前定位）"
              data-testid="directions-origin"
              aria-label="起點"
            />
          </div>

          <div className="dir-field">
            <MapPin className="dir-field__icon" strokeWidth={2.5} aria-hidden="true" />
            <input
              ref={destInputRef}
              className="tb-input dir-input"
              type="text"
              value={localDest}
              onChange={(e) => setLocalDest(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, false)}
              placeholder="終點"
              data-testid="directions-destination"
              aria-label="終點"
            />
          </div>

          {errorMessage && (
            <div className="dir-alert" role="alert">
              <Info className="mt-0.5 size-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Floating Directions Guide Panel（Google 會把指引塞進這個容器） */}
        <div ref={panelRef} id="panel" className={`dir-panel ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="dir-panel__head">
            <h2 className="dir-panel__title">
              <Navigation className="size-5" strokeWidth={2.5} aria-hidden="true" />
              導航指引
            </h2>
            <IconButton
              onClick={() => setShowPanel(false)}
              label="關閉導航面板"
              icon={<X strokeWidth={2.5} aria-hidden="true" />}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectionsPage
