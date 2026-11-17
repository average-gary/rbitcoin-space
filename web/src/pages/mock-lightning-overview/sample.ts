// Real mainnet answers, recorded once from the public site's GET routes (the routes the overview
// reads), checked with the page's own guards so the mock draws only what the server really sends.
import {
  type Closes,
  type FeedEvent,
  isCloses,
  isFeed,
  isMovers,
  type Movers,
  readFeed,
} from "../lightning/feed";
import { isOverview, isSeries, type Overview, type Series } from "../lightning/lightning";
import closesRaw from "./sample/closes.json?raw";
import feedRaw from "./sample/feed.json?raw";
import movers1mRaw from "./sample/movers_1m.json?raw";
import movers1wRaw from "./sample/movers_1w.json?raw";
import movers24hRaw from "./sample/movers_24h.json?raw";
import overviewRaw from "./sample/overview.json?raw";
import stats1mRaw from "./sample/statistics_1m.json?raw";
import stats1wRaw from "./sample/statistics_1w.json?raw";
import stats24hRaw from "./sample/statistics_24h.json?raw";

function read<T>(raw: string, guard: (v: unknown) => v is T, name: string): T {
  const v: unknown = JSON.parse(raw);
  if (!guard(v)) throw new Error(`sample ${name} does not match the route's shape`);
  return v;
}

export type PeriodId = "24h" | "1w" | "1m";

export const overview: Overview = read(overviewRaw, isOverview, "overview");
export const closes: Closes = read(closesRaw, isCloses, "closes");
export const feed: FeedEvent[] = readFeed(read(feedRaw, isFeed, "feed"));
export const series: Record<PeriodId, Series> = {
  "24h": read(stats24hRaw, isSeries, "statistics/24h"),
  "1w": read(stats1wRaw, isSeries, "statistics/1w"),
  "1m": read(stats1mRaw, isSeries, "statistics/1m"),
};
export const movers: Record<PeriodId, Movers> = {
  "24h": read(movers24hRaw, isMovers, "movers 24h"),
  "1w": read(movers1wRaw, isMovers, "movers 1w"),
  "1m": read(movers1mRaw, isMovers, "movers 1m"),
};
