export interface CityTile {
  city: string;
  count: number;
  photo: string | null;
}

export interface AgentEntry {
  id: string;
  title: string;
  subtitle: string | null;
  avatar: string | null;
  listings: number;
}

export declare const HIGHLIGHT_CITIES: string[];
export declare function rankCityTiles(tiles: CityTile[]): CityTile[];
export declare function tallyAgents(rows: { agent_id: string | null }[] | null): { id: string; listings: number }[];
export declare function joinAgents(
  tally: { id: string; listings: number }[],
  profiles: { id: string; full_name: string | null; agency_name: string | null; avatar_url: string | null }[] | null,
): AgentEntry[];
export declare function filterAgents(agents: AgentEntry[], query: string): AgentEntry[];
export declare function initialsOf(name: string | null | undefined): string;
