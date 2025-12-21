/**
 * StationMap Organism
 * Interactive map showing station locations using MapLibre GL JS
 */
import { useRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, Spinner } from '../atoms'

// Thailand center coordinates
const THAILAND_CENTER = [100.5018, 13.7563]
const THAILAND_ZOOM = 6

// MapLibre style URL - using OpenFreeMap which is free and reliable
const MAP_STYLE = {
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

// Get marker color based on PM2.5 value
function getMarkerColor(pm25) {
    if (pm25 === null || pm25 === undefined) return '#64748b'
    if (pm25 <= 25) return '#009966'
    if (pm25 <= 50) return '#00e400'
    if (pm25 <= 100) return '#ffff00'
    if (pm25 <= 200) return '#ff7e00'
    if (pm25 <= 300) return '#ff0000'
    return '#8f3f97'
}

export default function StationMap({
    stations = [],
    selectedStation,
    onStationSelect,
    loading = false,
    height = 500,
    className = '',
}) {
    const mapContainer = useRef(null)
    const map = useRef(null)
    const markers = useRef([])
    const [mapLoaded, setMapLoaded] = useState(false)
    const [mapError, setMapError] = useState(null)

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
                attributionControl: true,
            })

            // Add navigation controls
            map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

            // FORCE Load state after a short delay just in case events don't fire
            // This ensures the user isn't stuck on a spinner forever
            setTimeout(() => {
                console.log('StationMap: Force setting mapLoaded to true')
                setMapLoaded(true)
            }, 1000)

            map.current.on('load', () => {
                console.log('StationMap: Map loaded event fired')
                setMapLoaded(true)
            })

            map.current.on('error', (e) => {
                console.error('StationMap: MapLibre error:', e)
                setMapError(e.error?.message || 'Map loading error')
            })

        } catch (error) {
            console.error('StationMap: Initialization error:', error)
            setMapError(error.message)
        }

        // Cleanup on unmount
        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
    }, [])

    // Add/update markers when stations change
    useEffect(() => {
        if (!map.current) return

        // Remove existing markers
        markers.current.forEach(marker => marker.remove())
        markers.current = []

        // Add new markers for each station
        stations.forEach(station => {
            const lon = station.lon ?? station.longitude
            const lat = station.lat ?? station.latitude

            if (lat == null || lon == null) return

            // Create marker element
            const el = document.createElement('div')
            el.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: ${getMarkerColor(station.latest_pm25)};
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.2s ease;
      `

            // Hover effect
            el.addEventListener('mouseenter', () => {
                el.style.transform = 'scale(1.3)'
            })
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)'
            })

            // Click handler
            el.addEventListener('click', () => {
                onStationSelect?.(station.station_id)
            })

            // Create popup
            const popup = new maplibregl.Popup({
                offset: 15,
                closeButton: false,
            }).setHTML(`
        <div style="min-width: 150px; padding: 4px;">
          <strong style="color: #333;">${station.name_en || station.name_th || station.station_id}</strong><br/>
          <small style="color: #666;">ID: ${station.station_id}</small><br/>
          <span style="color: ${getMarkerColor(station.latest_pm25)}; font-weight: bold;">
            PM2.5: ${station.latest_pm25?.toFixed(1) ?? 'N/A'} μg/m³
          </span>
        </div>
      `)

            // Create and add marker
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([lon, lat])
                .setPopup(popup)
                .addTo(map.current)

            markers.current.push(marker)
        })
    }, [stations, onStationSelect]) // Removed mapLoaded dep to allow markers to add even if load event is late

    // Fly to selected station
    useEffect(() => {
        if (!map.current || !selectedStation) return

        const station = stations.find(s => s.station_id === selectedStation)
        const lon = station?.lon ?? station?.longitude
        const lat = station?.lat ?? station?.latitude

        if (lat && lon) {
            map.current.flyTo({
                center: [lon, lat],
                zoom: 10,
                duration: 1500,
            })

            // Open popup for selected station
            const markerIndex = stations.findIndex(s => s.station_id === selectedStation)
            if (markerIndex >= 0 && markers.current[markerIndex]) {
                markers.current[markerIndex].togglePopup()
            }
        }
    }, [selectedStation, stations])

    // Show error state
    if (mapError) {
        return (
            <Card padding="none" className={`overflow-hidden ${className}`}>
                <div
                    className="flex flex-col items-center justify-center bg-dark-800 text-dark-300"
                    style={{ height }}
                >
                    <span className="text-red-400">⚠️ Map Error</span>
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

StationMap.propTypes = {
    stations: PropTypes.array,
    selectedStation: PropTypes.string,
    onStationSelect: PropTypes.func,
    loading: PropTypes.bool,
    height: PropTypes.number,
    className: PropTypes.string,
}
