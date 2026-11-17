// Leaflet ships no TypeScript types and @types/leaflet is not a dependency.
// The web map module (leaflet-maps.tsx) is the only importer and uses a small,
// stable part of the API, so it is typed loosely here rather than adding one.
declare module 'leaflet';
declare module 'leaflet/dist/leaflet.css';
