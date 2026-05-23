import { useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Navigation } from 'lucide-react'
import { getMarkerIcon, MARKER_COLORS } from './MapMarker'
import { formatPrice, gradientFor } from '../lib/format'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import '../styles/map.css'

const TIRANA_CENTER = [41.3275, 19.8187]
const DEFAULT_ZOOM = 13

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
          center={center}
          zoom={zoom}
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
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
            >
              {mappable.map(property => (
                <Marker
                  key={property.id}
                  position={[property.latitude, property.longitude]}
                  icon={getMarkerIcon(property.listing_type)}
                >
                  <Popup>
                    <PropertyPopup property={property} />
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
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
