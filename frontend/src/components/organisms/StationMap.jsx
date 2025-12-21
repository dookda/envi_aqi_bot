/**
 * StationMap Organism
 * Interactive map showing station locations using MapLibre GL
 */
import { useRef, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, Spinner } from '../atoms'
import { getAqiLabel } from '../atoms/Badge'

// Thailand center coordinates
const THAILAND_CENTER = [100.5018, 13.7563]
const THAILAND_ZOOM = 5

// Get marker color based on PM2.5 value
function getMarkerColor(pm25) {
    if (pm25 === null || pm25 === undefined) return '#64748b' // Gray for no data
    if (pm25 <= 25) return '#009966'  // Excellent
    if (pm25 <= 50) return '#00e400'  // Good
    if (pm25 <= 100) return '#ffff00' // Moderate
    if (pm25 <= 200) return '#ff7e00' // Unhealthy sensitive
    if (pm25 <= 300) return '#ff0000' // Unhealthy
    return '#8f3f97' // Very Unhealthy
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

    // Initialize map
    useEffect(() => {
        if (map.current || !mapContainer.current) return

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '© <a href="https://carto.com/">CARTO</a>',
                    },
                },
                layers: [
                    {
                        id: 'carto-dark-layer',
                        type: 'raster',
                        source: 'carto-dark',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: THAILAND_CENTER,
            zoom: THAILAND_ZOOM,
        })

        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
        map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left')

        return () => {
            map.current?.remove()
            map.current = null
        }
    }, [])

    // Create popup content
    const createPopupContent = useCallback((station) => {
        const pm25Display = station.latest_pm25 !== null
            ? `${station.latest_pm25.toFixed(1)} μg/m³`
            : 'No data'
        const aqiLevel = station.latest_pm25 !== null
            ? getAqiLabel(station.latest_pm25)
            : 'Unknown'

        return `
      <div class="p-2">
        <h3 class="font-bold text-base mb-1">${station.name_en || station.name_th}</h3>
        <p class="text-sm text-dark-300 mb-2">ID: ${station.station_id}</p>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm">PM2.5:</span>
          <span class="font-bold" style="color: ${getMarkerColor(station.latest_pm25)}">${pm25Display}</span>
        </div>
        <p class="text-xs text-dark-400">${aqiLevel}</p>
      </div>
    `
    }, [])

    // Update markers when stations change
    useEffect(() => {
        if (!map.current) return

        // Clear existing markers
        markers.current.forEach(marker => marker.remove())
        markers.current = []

        // Add new markers
        stations.forEach(station => {
            if (!station.lat || !station.lng) return

            // Create marker element
            const el = document.createElement('div')
            el.className = 'station-marker'
            el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: ${getMarkerColor(station.latest_pm25)};
        border: 3px solid rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `

            // Hover effect
            el.addEventListener('mouseenter', () => {
                el.style.transform = 'scale(1.3)'
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
            })
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)'
                el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
            })

            // Create popup
            const popup = new maplibregl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false,
            }).setHTML(createPopupContent(station))

            // Create marker
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([station.lng, station.lat])
                .setPopup(popup)
                .addTo(map.current)

            // Click handler
            el.addEventListener('click', () => {
                onStationSelect?.(station.station_id)
            })

            markers.current.push(marker)
        })
    }, [stations, createPopupContent, onStationSelect])

    // Fly to selected station
    useEffect(() => {
        if (!map.current || !selectedStation) return

        const station = stations.find(s => s.station_id === selectedStation)
        if (station?.lat && station?.lng) {
            map.current.flyTo({
                center: [station.lng, station.lat],
                zoom: 10,
                duration: 1500,
            })

            // Open popup for selected marker
            const markerIndex = stations.findIndex(s => s.station_id === selectedStation)
            if (markerIndex >= 0 && markers.current[markerIndex]) {
                markers.current[markerIndex].togglePopup()
            }
        }
    }, [selectedStation, stations])

    return (
        <Card padding="none" className={`overflow-hidden ${className}`}>
            {loading ? (
                <div className="flex items-center justify-center" style={{ height }}>
                    <Spinner size="xl" />
                </div>
            ) : (
                <div ref={mapContainer} style={{ width: '100%', height }} />
            )}
        </Card>
    )
}

StationMap.propTypes = {
    stations: PropTypes.arrayOf(
        PropTypes.shape({
            station_id: PropTypes.string.isRequired,
            name_th: PropTypes.string,
            name_en: PropTypes.string,
            lat: PropTypes.number,
            lng: PropTypes.number,
            latest_pm25: PropTypes.number,
        })
    ),
    selectedStation: PropTypes.string,
    onStationSelect: PropTypes.func,
    loading: PropTypes.bool,
    height: PropTypes.number,
    className: PropTypes.string,
}
