import L from 'leaflet'
import { formatCompactPrice } from '../../../lib/format'

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

const priceIconCache = {}

/**
 * A price bubble instead of a pin, so the map communicates price at a
 * glance. iconSize/iconAnchor are [0,0] on purpose: the bubble's own width
 * varies with label length ("€89K" vs "€1.2M"), so instead of measuring
 * text we let Leaflet place a zero-size anchor exactly at the coordinate
 * and use CSS (translate(-50%,-50%) in map.css) to center the bubble over
 * it regardless of width.
 */
export function getPriceMarkerIcon(listingType, price) {
  const color = COLORS[listingType] || COLORS.sale
  const label = formatCompactPrice(price)
  const key = `${color}:${label}`
  if (priceIconCache[key]) return priceIconCache[key]

  const icon = L.divIcon({
    className: 'price-marker-icon',
    html: `<div class="price-marker" style="background:${color}">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  })
  priceIconCache[key] = icon
  return icon
}

const countIconCache = {}

/**
 * The circle badge for a county in the map's region-overview mode. Same
 * zero-size-anchor + CSS-centering trick as getPriceMarkerIcon, but a fixed
 * circle instead of a width-varying pill since it only ever holds a number.
 */
export function getCountMarkerIcon(count) {
  if (countIconCache[count]) return countIconCache[count]

  const icon = L.divIcon({
    className: 'county-marker-icon',
    html: `<div class="county-marker">${count}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
  countIconCache[count] = icon
  return icon
}

export const MARKER_COLORS = COLORS
