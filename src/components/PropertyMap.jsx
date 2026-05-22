import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export default function PropertyMap({ lat, lng }) {
  const center = { lat: Number(lat), lng: Number(lng) }

  if (!API_KEY) {
    return (
      <div style={{ height: 200, borderRadius: 'var(--r-md)', background: 'var(--fho-surface)', border: '0.5px solid var(--fho-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fho-text-muted)', fontSize: 13 }}>
        Map unavailable
      </div>
    )
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div style={{ height: 200, borderRadius: 'var(--r-md)', overflow: 'hidden', border: '0.5px solid var(--fho-border)' }}>
        <Map defaultCenter={center} defaultZoom={15} gestureHandling="cooperative" disableDefaultUI mapId="fho-property-map">
          <AdvancedMarker position={center}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
          </AdvancedMarker>
        </Map>
      </div>
    </APIProvider>
  )
}
