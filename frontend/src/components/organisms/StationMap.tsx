/**
 * StationMap Organism
 * Interactive map showing station locations using MapLibre GL JS with native circle layers
 */
import { useRef, useEffect, useState } from 'react'
import type { Station } from '@/types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, Spinner } from '../atoms'
import { useLanguage, useTheme } from '../../contexts'

// Thailand center coordinates
const THAILAND_CENTER: [number, number] = [100.5018, 13.7563]
const THAILAND_ZOOM = 6

// MapLibre style URL - using OpenStreetMap tiles
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

interface StationWithPM25 extends Station {
  latest_pm25?: number
  longitude?: number
  latitude?: number
}

// Get marker color based on PM2.5 value (AQI standard colors)
function getMarkerColor(pm25: number | null | undefined): string {
  if (pm25 === null || pm25 === undefined) return '#64748b' // Gray for no data
  if (pm25 <= 25) return '#009966'   // Good (green)
  if (pm25 <= 50) return '#00e400'   // Moderate (yellow-green)
  if (pm25 <= 100) return '#ffff00'  // Unhealthy for sensitive (yellow)
  if (pm25 <= 200) return '#ff7e00'  // Unhealthy (orange)
  if (pm25 <= 300) return '#ff0000'  // Very unhealthy (red)
  return '#8f3f97'                   // Hazardous (purple)
}

interface StationMapProps {
  stations?: StationWithPM25[]
  selectedStation?: string
  onStationSelect?: (stationId: string) => void
  loading?: boolean
  height?: number
  className?: string
  showAnomalies?: boolean
  onShowAnomaliesChange?: (show: boolean) => void
}

const StationMap: React.FC<StationMapProps> = ({
  stations = [],
  selectedStation,
  onStationSelect,
  loading = false,
  height = 500,
  className = '',
  showAnomalies = true,
  onShowAnomaliesChange,
}) => {
  const { t } = useLanguage()
  const { isLight } = useTheme()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const hoveredStationId = useRef<number | null>(null)

  // Initialize map
  useEffect(() => {
    console.log('StationMap: Initializing map...')
    if (map.current) {
      console.log('StationMap: Map already initialized')
      return
    }

    if (!mapContainer.current) {
      console.error('StationMap: Container ref is null')
      return
    }

    try {
      console.log('StationMap: Creating map instance...')
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: THAILAND_CENTER,
        zoom: THAILAND_ZOOM,
        attributionControl: {},
      })

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.current.on('load', () => {
        console.log('StationMap: Map loaded, adding layers...')

        // Add GeoJSON source for stations
        map.current!.addSource('stations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        })

        // Add circle layer for station markers
        map.current!.addLayer({
          id: 'station-circles',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              5, 4,      // At zoom 5, radius = 4px
              8, 6,      // At zoom 8, radius = 6px
              12, 10,    // At zoom 12, radius = 10px
              15, 14     // At zoom 15, radius = 14px
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': ['case',
              ['boolean', ['feature-state', 'hover'], false],
              0.9,
              1
            ]
          }
        })

        // Add circle layer for hover effect (slightly larger)
        map.current!.addLayer({
          id: 'station-circles-hover',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              5, 6,      // At zoom 5, radius = 6px (2px larger)
              8, 9,      // At zoom 8, radius = 9px
              12, 14,    // At zoom 12, radius = 14px
              15, 19     // At zoom 15, radius = 19px
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
            'circle-stroke-opacity': ['case',
              ['boolean', ['feature-state', 'hover'], false],
              1,
              0
            ]
          }
        })

        // Change cursor on hover
        map.current!.on('mouseenter', 'station-circles', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })

        map.current!.on('mouseleave', 'station-circles', () => {
          map.current!.getCanvas().style.cursor = ''
        })

        // Handle hover state
        map.current!.on('mousemove', 'station-circles', (e) => {
          if (e.features && e.features.length > 0) {
            // Remove hover from previous feature
            if (hoveredStationId.current !== null) {
              map.current!.setFeatureState(
                { source: 'stations', id: hoveredStationId.current },
                { hover: false }
              )
            }

            // Set hover on current feature
            hoveredStationId.current = e.features[0].id as number
            map.current!.setFeatureState(
              { source: 'stations', id: hoveredStationId.current },
              { hover: true }
            )
          }
        })

        map.current!.on('mouseleave', 'station-circles', () => {
          if (hoveredStationId.current !== null) {
            map.current!.setFeatureState(
              { source: 'stations', id: hoveredStationId.current },
              { hover: false }
            )
            hoveredStationId.current = null
          }
        })

        // Handle click
        map.current!.on('click', 'station-circles', (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0]
            const stationId = feature.properties?.station_id
            if (stationId) {
              onStationSelect?.(stationId)
            }
          }
        })

        // Create popup
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15
        })

        // Show popup on hover
        map.current!.on('mouseenter', 'station-circles', (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0]
            const coords = (feature.geometry as any).coordinates.slice()
            const props = feature.properties

            const pm25 = props?.pm25 !== null ? parseFloat(props?.pm25) : null
            const color = getMarkerColor(pm25)

            popup.setLngLat(coords)
              .setHTML(`
                <div style="min-width: 150px; padding: 4px;">
                  <strong style="color: #333;">${props?.name || props?.station_id}</strong><br/>
                  <small style="color: #666;">ID: ${props?.station_id}</small><br/>
                  <span style="color: ${color}; font-weight: bold;">
                    PM2.5: ${pm25 !== null ? pm25.toFixed(1) : 'N/A'} μg/m³
                  </span>
                </div>
              `)
              .addTo(map.current!)
          }
        })

        map.current!.on('mouseleave', 'station-circles', () => {
          popup.remove()
        })

        setMapLoaded(true)
      })

      map.current.on('error', (e: any) => {
        console.error('StationMap: MapLibre error:', e)
        setMapError(e.error?.message || 'Map loading error')
      })

    } catch (error) {
      console.error('StationMap: Initialization error:', error)
      setMapError((error as Error).message)
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [onStationSelect])

  // Update station data when stations change
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const source = map.current.getSource('stations') as maplibregl.GeoJSONSource
    if (!source) return

    // Convert stations to GeoJSON features
    const features = stations
      .filter(station => {
        const lon = station.lon ?? station.longitude
        const lat = station.lat ?? station.latitude
        return lat != null && lon != null
      })
      .map((station, index) => {
        const lon = station.lon ?? station.longitude
        const lat = station.lat ?? station.latitude
        const pm25 = station.latest_pm25
        const color = getMarkerColor(pm25)
        const name = station.name_en || station.name_th || station.station_id

        return {
          type: 'Feature' as const,
          id: index, // Use index as feature ID for feature-state
          geometry: {
            type: 'Point' as const,
            coordinates: [lon!, lat!]
          },
          properties: {
            station_id: station.station_id,
            name: name,
            pm25: pm25,
            color: color
          }
        }
      })

    // Update the source data
    source.setData({
      type: 'FeatureCollection',
      features: features
    })

    console.log(`StationMap: Updated ${features.length} station markers`)
  }, [stations, mapLoaded])

  // Fly to selected station
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedStation) return

    const station = stations.find(s => s.station_id === selectedStation)
    if (!station) return

    const lon = station?.lon ?? station?.longitude
    const lat = station?.lat ?? station?.latitude

    if (lat && lon) {
      map.current.flyTo({
        center: [lon, lat],
        zoom: 10,
        duration: 1500,
      })
    }
  }, [selectedStation, stations, mapLoaded])

  // Show error state
  if (mapError) {
    return (
      <Card padding="none" className={`overflow-hidden ${className}`}>
        <div
          className="flex flex-col items-center justify-center bg-dark-800 text-dark-300"
          style={{ height }}
        >
          <span className="text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            Map Error
          </span>
          <span className="text-sm mt-2">{mapError}</span>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="none" className={`overflow-hidden relative ${className}`}>
      {/* Map Container - Always rendered so ref exists */}
      <div
        ref={mapContainer}
        style={{ width: '100%', height, opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
      />

      {/* Show Anomalies Checkbox - Top Left */}
      {mapLoaded && onShowAnomaliesChange && (
        <div
          className={`absolute top-3 left-3 z-10 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm ${isLight
            ? 'bg-white/90 border border-gray-200'
            : 'bg-dark-800/90 border border-white/10'
            }`}
        >
          <label className={`flex items-center gap-2 text-sm cursor-pointer select-none ${isLight ? 'text-gray-700' : 'text-dark-200'
            }`}>
            <input
              type="checkbox"
              checked={showAnomalies}
              onChange={(e) => onShowAnomaliesChange(e.target.checked)}
              className={`w-4 h-4 rounded cursor-pointer ${isLight
                ? 'accent-primary-500'
                : 'accent-primary-400 border-dark-500'
                }`}
            />
            <span className="font-medium">{t('dashboard.showAnomalies')}</span>
          </label>
        </div>
      )}

      {/* Loading Overlay */}
      {!mapLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-dark-800"
          style={{ zIndex: 10 }}
        >
          <Spinner size="lg" />
          <span className="ml-2 text-dark-300">Loading map...</span>
        </div>
      )}
    </Card>
  )
}

export default StationMap
