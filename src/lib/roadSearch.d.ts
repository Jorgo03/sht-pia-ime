export interface RoadSuggestion {
  name: string
  latitude: number
  longitude: number
  /** Neighbourhood or district, to disambiguate same-named roads. May be ''. */
  context: string
}

export function parseRoadResults(raw: unknown): RoadSuggestion[]

export function searchRoads(args: {
  city: string
  query: string
  signal?: AbortSignal
}): Promise<RoadSuggestion[]>

export function geocodeCity(args: {
  city: string
  signal?: AbortSignal
}): Promise<{ latitude: number; longitude: number } | null>
