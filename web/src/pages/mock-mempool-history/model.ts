// MOCKUP, never merged: the figures the redesigned mempool history draws, from a recorded answer.
// Pure. The answer's shape and the band split come from the real page (../mempool/history.ts).
import { FEE_KEY_BOUNDS, widenBands } from "../../lib/format";
import { type History, netFlow, seriesOf } from "../mempool/history";

/** A block's worth of virtual size. */
const BLOCK_VB = 1_000_000;
/** The flow strip reads in means over this many seconds when the answer is finer: one block. */
export const FLOW_STEP = 600;

/** A band's range as the key prints it: `under 0.12`, `0.2–0.3`, `10+`. */
export const bandName = (k: number): string => {
  const from = FEE_KEY_BOUNDS[k];
  const to = FEE_KEY_BOUNDS[k + 1];
  if (k === 0) return `under ${to ?? ""}`;
  return to === undefined ? `${from ?? ""}+` : `${from ?? ""}–${to}`;
};

/** The period's four figures. */
export function figures(h: History) {
  const ps = h.points;
  const first = ps[0];
  const last = ps.at(-1);
  if (!first || !last) return undefined;
  const low = ps.reduce((a, b) => (b.vsize < a.vsize ? b : a));
  const peak = ps.reduce((a, b) => (b.vsize > a.vsize ? b : a));
  // The cheapest band the dearest block's worth reaches into, at the latest point.
  const bands = widenBands(last.bands).bands;
  let deep = -1;
  let acc = 0;
  for (let k = bands.length - 1; k >= 0; k--) {
    acc += bands[k] ?? 0;
    if (acc >= BLOCK_VB) {
      deep = k;
      break;
    }
  }
  return { last, low, peak, change: last.vsize - first.vsize, flow: netFlow(h), deep };
}

/**
 * The flow strip's points: arrivals, blocks and the rest in vB a second. A minute holds a block or
 * none, so finer answers are read in ten-minute means, else a block's minute dwarfs the arrivals.
 */
export function flowPoints(h: History) {
  const step = Math.max(h.step, FLOW_STEP);
  const groups = new Map<number, { n: number; in: number; mined: number; other: number }>();
  for (const p of h.points) {
    const t = Math.floor(p.time / step) * step;
    const g = groups.get(t) ?? { n: 0, in: 0, mined: 0, other: 0 };
    g.n += p.samples;
    g.in += p.in_vsize * p.samples;
    g.mined += p.mined_vsize * p.samples;
    g.other += Math.max(0, p.out_vsize - p.mined_vsize) * p.samples;
    groups.set(t, g);
  }
  const x: number[] = [];
  const entered: number[] = [];
  const mined: number[] = [];
  const other: number[] = [];
  for (const [t, g] of groups) {
    if (g.n === 0) continue;
    x.push(t);
    entered.push(g.in / g.n / 60);
    mined.push(g.mined / g.n / 60);
    other.push(g.other / g.n / 60);
  }
  return { step, x, entered, mined, other };
}

/**
 * The stacked layers from the floor band up (0 shows them all), in the order they stack: the
 * unsplit layer first where the answer has one, then the twelve bands. `band` is the key's index.
 */
export function layersFrom(h: History, floor: number) {
  const s = seriesOf(h);
  const all = [
    ...(s.unsplit ? [{ band: -1, values: s.unsplit }] : []),
    ...s.bands.map((values, k) => ({ band: k, values })),
  ];
  // The unsplit layer is everything under 0.2: it belongs to the view only when all is shown.
  const keep = all.map((l) => (l.band === -1 ? floor === 0 : l.band >= floor));
  const pick = <T>(xs: readonly T[]) => xs.filter((_, i) => keep[i] === true);
  return {
    x: s.x,
    layers: pick(all),
    joins: s.joins.map((j) => ({
      index: j.index,
      before: j.before ? pick(j.before) : undefined,
      after: j.after ? pick(j.after) : undefined,
    })),
  };
}

/** A sample as stored: the answer's fields with its points as columns, so the file stays small. */
type Columns = Omit<History, "points"> & {
  time: number[];
  samples: number[];
  count: number[];
  vsize: number[];
  min_fee_rate: number[];
  in_vsize: number[];
  out_vsize: number[];
  mined_vsize: number[];
  bands: number[][];
};

/** A stored sample back in the server's shape. Counts the page does not draw read as 0. */
export function fromColumns(c: Columns): History {
  const {
    time,
    samples,
    count,
    vsize,
    min_fee_rate,
    in_vsize,
    out_vsize,
    mined_vsize,
    bands,
    ...h
  } = c;
  return {
    ...h,
    points: time.map((t, i) => ({
      time: t,
      samples: samples[i] ?? 0,
      count: count[i] ?? 0,
      vsize: vsize[i] ?? 0,
      fees: 0,
      min_fee_rate: min_fee_rate[i] ?? 0,
      bands: bands[i] ?? [],
      in_count: 0,
      in_vsize: in_vsize[i] ?? 0,
      out_count: 0,
      out_vsize: out_vsize[i] ?? 0,
      mined_count: 0,
      mined_vsize: mined_vsize[i] ?? 0,
    })),
  };
}
