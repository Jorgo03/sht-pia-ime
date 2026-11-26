import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useTranslation } from 'react-i18next'
import { getMapProperties } from '../lib/api'
import { usePrice } from '../features/currency'
import { titleOf } from '../lib/format'
import PropertyCard from './PropertyCard'
import { ErrorState } from './States'

const icon = L.icon({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] })
const ALBANIA = [41.15, 20.0]

function boundsOf(map) {
  const b = map.getBounds()
  const r = (n) => Math.round(n * 1e4) / 1e4
  return { minLat: r(b.getSouth()), maxLat: r(b.getNorth()), minLng: r(b.getWest()), maxLng: r(b.getEast()) }
}

function Watch({ onBounds }) {
  const map = useMapEvents({ moveend: () => onBounds(boundsOf(map)) })
  return null
}

// The app's map view (app/(tabs)/explore, map mode) for the web: the homes
// with a position inside the visible area, listed beside the map.
export default function SearchMap({ filters }) {
  const { t, i18n } = useTranslation()
  const price = usePrice()
  const [bounds, setBounds] = useState(null)
  const f = useMemo(() => ({ ...filters, bounds }), [filters, bounds])
  const q = useQuery({ queryKey: ['map', f], queryFn: () => getMapProperties(f), enabled: bounds !== null, placeholderData: (prev) => prev })
  const homes = q.data ?? []

  return (
    <div className="search-map">
      <div className="search-map-canvas">
        <MapContainer
          center={ALBANIA}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          ref={(map) => {
            if (map && bounds === null) setBounds(boundsOf(map))
          }}
        >
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Watch onBounds={setBounds} />
          {homes.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon} alt={titleOf(p, i18n.resolvedLanguage)}>
              <Popup>
                <Link to={`/property/${p.id}`}>{titleOf(p, i18n.resolvedLanguage)}</Link>
                <br />
                <strong>{price(p.price, p.currency)}</strong>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="search-map-list">
        <p className="muted small" aria-live="polite">{q.data ? <><strong>{homes.length}</strong> {t('search.homesInView', { count: homes.length })}</> : t('common.loading')}</p>
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <div className="grid grid-2">
            {homes.slice(0, 24).map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
