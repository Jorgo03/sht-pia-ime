import L from 'leaflet'

const COLORS = {
  sale: '#FF7A40',
  rent: '#3B82F6',
  commercial: '#22C55E',
  land: '#EAB308',
}

function createSvgIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
          fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const iconCache = {}

export function getMarkerIcon(listingType) {
  const color = COLORS[listingType] || COLORS.sale
  if (iconCache[color]) return iconCache[color]

  const icon = L.icon({
    iconUrl: createSvgIcon(color),
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  })
  iconCache[color] = icon
  return icon
}

export const MARKER_COLORS = COLORS
