// MOCKUP, never merged: the figures each link preview card shows, worked out from one recorded
// sample (sample.json, GET answers from the public site). Only numbers, ids and names from our own
// pool list reach a card: never text taken from a transaction.
import {
  btcParts,
  feeBand,
  formatBtcShort,
  formatFeeRate,
  formatSats,
  formatSize,
  groupDigits,
  MONTHS,
  truncateMiddle,
  vsizeFromWeight,
} from "../../lib/format";
import sample from "./sample.json";

export const CARD_W = 1200;
export const CARD_H = 630;
export const CAPACITY_WU = 4_000_000;

interface RecordedTx {
  txid: string;
  fee: number;
  weight: number;
  size: number;
  inputs: number[];
  outputs: number[];
}

/** A colour set for one card. A card is a picture, so it has one theme, never the viewer's. */
export interface Palette {
  bg: string;
  surface: string;
  sunken: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  accent: string;
  positive: string;
  caution: string;
  series: string;
  ribbon: string;
}

export const LIGHT: Palette = {
  bg: "#f4f6f7",
  surface: "#ffffff",
  sunken: "#eef1f3",
  line: "#e1e6e9",
  lineStrong: "#7a868d",
  text: "#161b1e",
  muted: "#56616a",
  accent: "#a8196b",
  positive: "#1b6e43",
  caution: "#8a5a00",
  series: "#1f6f9c",
  ribbon: "#d6dcdf",
};

export const DARK: Palette = {
  bg: "#121518",
  surface: "#1b1f23",
  sunken: "#0e1113",
  line: "#2c3237",
  lineStrong: "#6f7b83",
  text: "#e6eaed",
  muted: "#9aa4ab",
  accent: "#f27ab9",
  positive: "#5fd39a",
  caution: "#f0b43c",
  series: "#6cb0dc",
  ribbon: "#3a4248",
};

/** The fee ramp: one set of values in both themes (design/tokens.css). */
export const FEE = [
  "#868a8d",
  "#798791",
  "#6b8494",
  "#698aa0",
  "#688fac",
  "#5885b7",
  "#5c89c3",
  "#5d86ce",
  "#6182d7",
  "#687ce0",
  "#7176e7",
  "#7b6fed",
] as const;

export const feeHex = (band: number): string => FEE[Math.min(Math.max(band, 1), 12) - 1] ?? FEE[0];

/** Lower bound of each band, as the fee key prints it. */
export const BAND_FLOOR = [
  "0.1",
  "0.12",
  "0.15",
  "0.2",
  "0.3",
  "0.5",
  "1",
  "1.5",
  "2",
  "3",
  "5",
  "10",
];

export const recordedAt: number = sample.recorded;

/** `17 Nov 2026` */
export function day(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ""} ${d.getUTCFullYear()}`;
}

/** `00:29 UTC` */
export function clock(unix: number): string {
  const d = new Date(unix * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/** `Aug 2024` */
export function month(unix: number): string {
  const d = new Date(unix * 1000);
  return `${MONTHS[d.getUTCMonth()] ?? ""} ${d.getUTCFullYear()}`;
}

/** A number and its unit, kept apart so the unit can be set smaller and muted. */
export interface Figure {
  label: string;
  value: string;
  /** Trailing zeros of an exact BTC amount, dimmed. */
  zeros?: string;
  unit?: string;
  sub?: string;
}

/** An exact amount: the significant part and its dimmed trailing zeros. */
export function exactBtc(sats: number): { value: string; zeros: string } {
  const p = btcParts(sats);
  if (!p) return { value: "–", zeros: "" };
  return { value: `${p.sign}${p.whole}.${p.significant}`, zeros: p.zeros };
}

export interface TxCard {
  kind: "tx";
  confirmed: boolean;
  path: string;
  id: string;
  amount: { value: string; zeros: string };
  rate: number;
  band: number;
  rateText: string;
  fee: string;
  size: string;
  inputs: number[];
  outputs: number[];
  feeSats: number;
  /** Confirmed: the block. Unconfirmed: the snapshot the card was drawn at. */
  height?: number;
  time: number;
}

function txCard(t: RecordedTx, confirmed: boolean, time: number, height?: number): TxCard {
  const vsize = vsizeFromWeight(t.weight);
  const rate = t.fee / vsize;
  return {
    kind: "tx",
    confirmed,
    path: `tx/${t.txid}`,
    id: truncateMiddle(t.txid),
    amount: exactBtc(t.outputs.reduce((a, b) => a + b, 0)),
    rate,
    band: feeBand(rate),
    rateText: formatFeeRate(rate),
    fee: formatSats(t.fee),
    size: formatSize(vsize).replace(" vB", ""),
    inputs: t.inputs,
    outputs: t.outputs,
    feeSats: t.fee,
    ...(height === undefined ? {} : { height }),
    time,
  };
}

export const confirmedTx = txCard(sample.tx, true, sample.tx.time, sample.tx.height);
export const unconfirmedTx = txCard(sample.unconfirmed, false, sample.recorded);

export interface BlockFacts {
  height: number;
  heightText: string;
  id: string;
  hash: string;
  time: number;
  txCount: string;
  fill: number;
  bands: number[];
  median: string;
  fees: string;
  feesExact: { value: string; zeros: string };
  miner: string;
  size: string;
}

const blocks: BlockFacts[] = sample.blocks.map((b) => ({
  height: b.height,
  heightText: groupDigits(b.height),
  id: truncateMiddle(b.hash),
  hash: b.hash,
  time: b.time,
  txCount: groupDigits(b.txCount),
  fill: b.weight / CAPACITY_WU,
  bands: b.bands,
  median: formatFeeRate(b.medianRate),
  fees: formatBtcShort(b.fees),
  feesExact: exactBtc(b.fees),
  miner: b.miner,
  size: formatSize(b.size, "B"),
}));

/** Newest first: the block every card is about, then the five before it. */
export const strip = blocks;
export const block: BlockFacts = blocks[0] ?? (undefined as never);

export interface Projected {
  bands: number[];
  fill: number;
  median: string;
}

export const projected: Projected[] = sample.projected.map((p) => ({
  bands: p.bands,
  fill: Math.min(1, p.vsize / (CAPACITY_WU / 4)),
  median: formatFeeRate(p.medianRate),
}));

/** The projected block an unconfirmed transaction's rate places it in, 0 for the next. */
export const waitsIn = (() => {
  const r = unconfirmedTx.rate;
  const i = sample.projected.findIndex((p) => {
    const lowest = p.bands.findIndex((v) => v > 0);
    return lowest !== -1 && feeBand(r) >= lowest + 1;
  });
  return i === -1 ? sample.projected.length - 1 : i;
})();

export interface AddressCard {
  kind: "address";
  path: string;
  id: string;
  balance: string;
  received: string;
  txCount: string;
  lastActive: number;
  /** Confirmed balance after each recorded transaction, oldest first: [unix, sats]. */
  steps: [number, number][];
  tip: string;
}

export const address: AddressCard = (() => {
  const a = sample.address;
  const balance = a.funded - a.spent;
  const steps: [number, number][] = [];
  let b = balance;
  for (const [time, value] of a.history) {
    steps.push([time ?? 0, b]);
    b -= value ?? 0;
  }
  steps.reverse();
  return {
    kind: "address",
    path: `address/${a.address}`,
    id: truncateMiddle(a.address),
    balance: formatBtcShort(balance),
    received: formatBtcShort(a.funded),
    txCount: groupDigits(a.txCount),
    lastActive: a.history[0]?.[0] ?? 0,
    steps,
    tip: groupDigits(sample.tip),
  };
})();

/** Where the layers of a block sit in a box of `h` px, bottom up: [band, y from the floor, height]. */
export function layers(
  bands: readonly number[],
  fill: number,
  h: number,
): [number, number, number][] {
  const total = bands.reduce((a, b) => a + b, 0);
  const out: [number, number, number][] = [];
  let y = 0;
  const top = Math.min(1, fill) * h;
  for (const [i, v] of bands.entries()) {
    if (v <= 0) continue;
    // Whole pixels, so neighbouring layers meet without a seam.
    const next = Math.round(y + Math.max(2, (v / total) * top));
    out.push([i + 1, y, next - y]);
    y = next;
  }
  return out;
}
