export interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  /**
   * Where to point the camera — a selected road, or the city centre.
   *
   * Deliberately not the pin. Moving the map and placing the property are two
   * different claims: a road's coordinate is the midpoint of a line that can
   * run for a kilometre, and the city centre is not a building at all. If this
   * dropped a marker, an agent who never touched the map would publish that
   * approximation as their address. So this only frames the view, and the
   * coordinates still come from a tap or a drag.
   */
  focus?: { latitude: number; longitude: number } | null;
}
