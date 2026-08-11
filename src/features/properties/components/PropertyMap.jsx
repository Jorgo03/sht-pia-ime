import { useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Navigation } from 'lucide-react'
import { getMarkerIcon, getPriceMarkerIcon, getCountMarkerIcon, MARKER_COLORS } from './MapMarker'
import { formatPrice, gradientFor } from '../../../lib/format'
import { pointInGeometry, geometryCentroid, geometryBounds, unionBounds } from '../../../lib/geo'
import albaniaCounties from '../../../data/albania-counties.json'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import '../../../styles/map.css'

const TIRANA_CENTER = [41.3275, 19.8187]
const DEFAULT_ZOOM = 13

const ALBANIA_BOUNDS = unionBounds(albaniaCounties.features.map(f => geometryBounds(f.geometry)))

// Below this zoom the region view (county circles) shows; at/above it, the
// selected county's own listings show. fitBounds(ALBANIA_BOUNDS) lands
// around 7-8 on common viewports, fitBounds(a single county) lands 10+, so
// 9 sits in the gap between them without flickering at either edge.
const REGION_ZOOM_THRESHOLD = 9

const COUNTY_ID = feature => feature.properties.GID_1

function groupByCounty(properties) {
  const groups = albaniaCounties.features.map(feature => ({ feature, properties: [] }))
  for (const p of properties) {
    // Properties whose coordinates don't land inside any county polygon
    // (bad data, or just off the coastline) have no circle to belong to in
    // this view — an existing-data problem, not something to fudge here.
    const match = groups.find(g => pointInGeometry(p.longitude, p.latitude, g.feature.geometry))
    if (match) match.properties.push(p)
  }
  return groups.filter(g => g.properties.length > 0)
}

function LocateButton() {
  const map = useMap()
  const [loading, setLoading] = useState(false)

  const handleLocate = () => {
    if (!navigator.geolocation) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15)
        setLoading(false)
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <button
      className={`locate-btn ${loading ? 'loading' : ''}`}
      onClick={handleLocate}
      title="My location"
    >
      <Navigation size={16} />
    </button>
  )
}

function PropertyPopup({ property }) {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const price = formatPrice(property.price, i18n.language)
  const suffix = property.listing_type === 'rent' ? '/mo' : ''
  const hasImage = property.image_urls?.[0]

  return (
    <div className="map-popup">
      {hasImage ? (
        <img src={property.image_urls[0]} alt="" className="map-popup-image" />
      ) : (
        <div className="map-popup-gradient" style={{ background: gradientFor(property.id) }} />
      )}
      <div className="map-popup-title">{property.title}</div>
      <div className="map-popup-price">{price}{suffix}</div>
      <div className="map-popup-type">
        {property.property_type} &middot; {property.listing_type}
      </div>
      <button className="map-popup-btn" onClick={() => navigate(`/property/${property.id}`)}>
        View Details
      </button>
    </div>
  )
}

function PropertyMarkers({ properties }) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
    >
      {properties.map(property => (
        <Marker
          key={property.id}
          position={[property.latitude, property.longitude]}
          icon={getPriceMarkerIcon(property.listing_type, property.price)}
        >
          <Popup>
            <PropertyPopup property={property} />
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  )
}

/**
 * Region-grouped map layer: county circles by default, a single county's own
 * listings after tapping one. Lives inside <MapContainer> (needs useMap) and
 * owns the zoom-driven back-to-overview behavior itself, so PropertyMap
 * doesn't need to reach into the map instance at all.
 */
function CountyRegionLayer({ properties }) {
  const map = useMap()
  const [selectedId, setSelectedId] = useState(null)

  useMapEvents({
    zoomend() {
      if (selectedId && map.getZoom() < REGION_ZOOM_THRESHOLD) setSelectedId(null)
    },
  })

  const countyGroups = useMemo(() => groupByCounty(properties), [properties])

  if (selectedId) {
    const group = countyGroups.find(g => COUNTY_ID(g.feature) === selectedId)
    return <PropertyMarkers properties={group ? group.properties : []} />
  }

  return (
    <>
      <GeoJSON
        data={albaniaCounties}
        style={{ color: '#ff7d1a', weight: 1, opacity: 0.5, fillColor: '#ff7d1a', fillOpacity: 0.04 }}
      />
      {countyGroups.map(({ feature, properties: regionProperties }) => (
        <Marker
          key={COUNTY_ID(feature)}
          position={geometryCentroid(feature.geometry)}
          icon={getCountMarkerIcon(regionProperties.length)}
          eventHandlers={{
            click: () => {
              setSelectedId(COUNTY_ID(feature))
              map.fitBounds(geometryBounds(feature.geometry), { padding: [24, 24] })
            },
          }}
        />
      ))}
    </>
  )
}

export default function PropertyMap({ properties, lat, lng }) {
  const mapRef = useRef(null)

  const isSinglePin = lat != null && lng != null
  const center = isSinglePin ? [Number(lat), Number(lng)] : TIRANA_CENTER
  const zoom = isSinglePin ? 15 : DEFAULT_ZOOM
  const mappable = isSinglePin ? [] : (properties || []).filter(p => p.latitude && p.longitude)

  return (
    <div>
      <div className="map-wrapper" style={isSinglePin ? { height: 200 } : undefined}>
        <MapContainer
          center={isSinglePin ? center : undefined}
          zoom={isSinglePin ? zoom : undefined}
          bounds={isSinglePin ? undefined : ALBANIA_BOUNDS}
          ref={mapRef}
          scrollWheelZoom={!isSinglePin}
          dragging={!isSinglePin}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {isSinglePin ? (
            <Marker position={center} icon={getMarkerIcon('sale')} />
          ) : (
            <CountyRegionLayer properties={mappable} />
          )}
          {!isSinglePin && <LocateButton />}
        </MapContainer>
      </div>
      {!isSinglePin && (
        <div className="map-legend">
          {Object.entries(MARKER_COLORS).map(([type, color]) => (
            <div key={type} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
