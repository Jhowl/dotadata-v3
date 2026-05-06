export type League = {
  id: string;
  slug: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

export type Team = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

export type Patch = {
  id: string;
  patch: string;
};

export type Hero = {
  id: string;
  localizedName: string;
  name: string;
};

export type PickBanEntry = {
  is_pick: boolean;
  hero_id: number;
  team: number;
  order?: number;
};

export type PickBanStat = {
  heroId: string;
  team: number | null;
  total: number;
};

export type Match = {
  id: string;
  leagueId: string;
  duration: number;
  startTime: string;
  direScore: number;
  radiantScore: number;
  radiantWin: boolean;
  seriesType: string | null;
  seriesId: string | null;
  radiantTeamId: string | null;
  direTeamId: string | null;
  firstTowerTeamId: string | null;
  firstTowerTime: number | null;
  picksBans: PickBanEntry[] | null;
  patchId: string;
};
