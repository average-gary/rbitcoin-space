// MOCKUP, never merged: the drawing parts the preview cards share. Only what a server could draw
// without a browser: flat fills, lines, rounded rectangles, cubic curves and text in one font.
import type { JSX } from "@solidjs/web";
import { feeHex, layers, type Palette } from "./model";

/** Width of monospace text: Recursive Mono's advance is 0.6 em, its narrow space 0.15 em. */
export function mw(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += ch === "\u202F" ? 0.15 : 0.6;
  return em * size;
}

/** The project's mark, in a card's own colours. */
export function Logo(props: { x: number; y: number; size: number; ink: string; top: string }) {
  return (
    <svg x={props.x} y={props.y} width={props.size} height={props.size} viewBox="0 0 64 64">
      <g fill={props.ink}>
        <rect x="19" y="18" width="26" height="5.5" rx="1.6" />
        <rect x="19" y="11" width="26" height="5.5" rx="1.6" fill-opacity="0.6" />
        <rect fill={props.top} x="27" y="4" width="18" height="5.5" rx="1.6" />
        <path d="M9.5 31C3 27 3 14 10.5 9.5 13.5 7.8 17 8 20 9.5L14 15.8 19.5 20.5C18 26 14.5 30 9.5 31ZM54.5 31C61 27 61 14 53.5 9.5 50.5 7.8 47 8 44 9.5L50 15.8 44.5 20.5C46 26 49.5 30 54.5 31ZM24.7 28.6a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 1 0-4.6 0ZM34.7 28.6a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 1 0-4.6 0ZM17 43C17 36 23 33 32 33 41 33 47 36 47 43 47 49 41 52 32 52 23 52 17 49 17 43Z" />
      </g>
      <g fill="none" stroke={props.ink} stroke-linecap="round" stroke-linejoin="round">
        <path stroke-width="3.2" d="M20 40C13 37 10 33 10 28M44 40C51 37 54 33 54 28" />
        <path stroke-width="2.4" d="M28 35 27 30M36 35 37 30" />
        <path
          stroke-width="3"
          d="M20 45 12 47 8 53M22 49 15 53 13 59M26 51 22 57 22 61M44 45 52 47 56 53M42 49 49 53 51 59M38 51 42 57 42 61"
        />
      </g>
    </svg>
  );
}

/** One line of text. */
export function T(props: {
  x: number;
  y: number;
  size: number;
  fill: string;
  bold?: boolean;
  end?: boolean;
  children: JSX.Element;
}) {
  return (
    <text
      x={props.x}
      y={props.y}
      font-size={String(props.size)}
      font-weight={props.bold === true ? "600" : "400"}
      fill={props.fill}
      text-anchor={props.end === true ? "end" : "start"}
    >
      {props.children}
    </text>
  );
}

/** A figure's value: the number, its dimmed trailing zeros, then its unit smaller and muted. */
export function Value(props: {
  x: number;
  y: number;
  size: number;
  unitSize: number;
  pal: Palette;
  value: string;
  zeros?: string | undefined;
  unit?: string | undefined;
  color?: string;
}) {
  return (
    <text
      x={props.x}
      y={props.y}
      font-size={String(props.size)}
      font-weight="600"
      fill={props.color ?? props.pal.text}
    >
      {props.value}
      {props.zeros ? <tspan fill={props.pal.muted}>{props.zeros}</tspan> : null}
      {props.unit ? (
        <tspan font-size={String(props.unitSize)} font-weight="400" fill={props.pal.muted}>
          {` ${props.unit}`}
        </tspan>
      ) : null}
    </text>
  );
}

/** A tick: confirmed. */
export function Check(props: { x: number; y: number; s: number; color: string }) {
  const { x, y, s } = props;
  return (
    <path
      d={`M${x} ${y + s * 0.55} L${x + s * 0.38} ${y + s * 0.9} L${x + s} ${y + s * 0.15}`}
      fill="none"
      stroke={props.color}
      stroke-width={s * 0.16}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  );
}

/** A clock: waiting. */
export function Clock(props: { x: number; y: number; s: number; color: string }) {
  const r = props.s / 2;
  const cx = props.x + r;
  const cy = props.y + r;
  return (
    <g fill="none" stroke={props.color} stroke-width={props.s * 0.13} stroke-linecap="round">
      <circle cx={cx} cy={cy} r={r - props.s * 0.07} />
      <path d={`M${cx} ${cy - r * 0.5} V${cy} L${cx + r * 0.38} ${cy + r * 0.28}`} />
    </g>
  );
}

/** Status as a pill: an icon and a word, in the status colour. Returns its width through `w`. */
export function Chip(props: {
  x: number;
  cy: number;
  size: number;
  confirmed: boolean;
  pal: Palette;
}) {
  const word = props.confirmed ? "Confirmed" : "Unconfirmed";
  const color = props.confirmed ? props.pal.positive : props.pal.caution;
  const h = props.size * 1.6;
  const icon = props.size * 0.9;
  const pad = props.size * 0.6;
  const w = pad + icon + props.size * 0.35 + mw(word, props.size) + pad;
  return (
    <g>
      <rect
        x={props.x}
        y={props.cy - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill="none"
        stroke={color}
        stroke-width="2.5"
      />
      {props.confirmed ? (
        <Check x={props.x + pad} y={props.cy - icon / 2} s={icon} color={color} />
      ) : (
        <Clock x={props.x + pad} y={props.cy - icon / 2} s={icon} color={color} />
      )}
      <text
        x={props.x + pad + icon + props.size * 0.35}
        y={props.cy + props.size * 0.36}
        font-size={String(props.size)}
        font-weight="600"
        fill={color}
      >
        {word}
      </text>
    </g>
  );
}

/** The network as the site's switch names it: a dot and a word. */
export function Network(props: { x: number; y: number; size: number; pal: Palette }) {
  const w = mw("Mainnet", props.size);
  return (
    <g>
      <circle
        cx={props.x - w - props.size * 0.5}
        cy={props.y - props.size * 0.35}
        r={props.size * 0.22}
        fill={props.pal.text}
      />
      <T x={props.x} y={props.y} size={props.size} fill={props.pal.muted} end>
        Mainnet
      </T>
    </g>
  );
}

/** A block's fee bands as settled layers in a box the size of its capacity, cheapest at the bottom. */
export function Core(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  bands: readonly number[];
  fill: number;
  pal: Palette;
  dashed?: boolean;
  frame?: string | undefined;
  frameWidth?: number;
  inset?: number;
}) {
  const inset = props.inset ?? 4;
  const inner = props.h - inset * 2;
  return (
    <g>
      {layers(props.bands, props.fill, inner).map(([band, y, h]) => (
        <rect
          x={props.x + inset}
          y={props.y + inset + inner - y - h}
          width={props.w - inset * 2}
          height={h}
          fill={feeHex(band)}
        />
      ))}
      <rect
        x={props.x}
        y={props.y}
        width={props.w}
        height={props.h}
        rx="6"
        fill="none"
        stroke={props.frame ?? (props.dashed === true ? props.pal.lineStrong : props.pal.line)}
        stroke-width={props.frameWidth ?? 2}
        stroke-dasharray={props.dashed === true ? "10 8" : undefined}
      />
    </g>
  );
}

/** Where in a core a band's layer sits: its middle, from the top of the box. */
export function layerMiddle(
  bands: readonly number[],
  fill: number,
  h: number,
  band: number,
  inset = 4,
) {
  const inner = h - inset * 2;
  const l = layers(bands, fill, inner).find(([b]) => b === band);
  if (!l) return inset;
  return inset + inner - l[1] - l[2] / 2;
}

/** The labels beside a core: each layer tall enough for one gets its band's lower bound. */
export function CoreKey(props: {
  x: number;
  y: number;
  h: number;
  bands: readonly number[];
  fill: number;
  size: number;
  pal: Palette;
  floors: readonly string[];
  inset?: number;
}) {
  const inset = props.inset ?? 4;
  const inner = props.h - inset * 2;
  return (
    <g>
      {layers(props.bands, props.fill, inner)
        .filter((l) => l[2] >= props.size * 1.1)
        .map(([band, y]) => (
          <g>
            <line
              x1={props.x - 10}
              x2={props.x - 2}
              y1={props.y + inset + inner - y}
              y2={props.y + inset + inner - y}
              stroke={props.pal.lineStrong}
              stroke-width="2"
            />
            <T
              x={props.x + 4}
              y={props.y + inset + inner - y + props.size * 0.35}
              size={props.size}
              fill={props.pal.muted}
            >
              {props.floors[band - 1] ?? ""}
            </T>
          </g>
        ))}
    </g>
  );
}

/** The transaction marked in a drawing: a square in its fee colour, ringed in the accent. */
export function Marker(props: {
  cx: number;
  cy: number;
  s: number;
  band: number;
  ring: string;
  gap: string;
}) {
  const h = props.s / 2;
  return (
    <g>
      <rect
        x={props.cx - h - 5}
        y={props.cy - h - 5}
        width={props.s + 10}
        height={props.s + 10}
        rx="5"
        fill={props.ring}
      />
      <rect
        x={props.cx - h - 2}
        y={props.cy - h - 2}
        width={props.s + 4}
        height={props.s + 4}
        rx="3"
        fill={props.gap}
      />
      <rect
        x={props.cx - h}
        y={props.cy - h}
        width={props.s}
        height={props.s}
        rx="2"
        fill={feeHex(props.band)}
      />
    </g>
  );
}

const ribbon = (x1: number, a1: number, b1: number, x2: number, a2: number, b2: number) => {
  const m = (x1 + x2) / 2;
  return `M${x1} ${a1}C${m} ${a1} ${m} ${a2} ${x2} ${a2}L${x2} ${b2}C${m} ${b2} ${m} ${b1} ${x1} ${b1}Z`;
};

/**
 * Inputs to outputs, as the transaction page draws them: inputs gather into one stem, which splits
 * into the outputs and the fee. Heights follow value; nothing is thinner than `min` px.
 */
export function Flow(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  inputs: readonly number[];
  outputs: readonly number[];
  fee: number;
  band: number;
  pal: Palette;
  stem: number;
}) {
  const min = 5;
  const total = props.inputs.reduce((a, b) => a + b, 0);
  const k = props.stem / total;
  const bar = 14;
  const gapPx = 14;
  const side = (values: readonly number[]) => {
    const hs = values.map((v) => Math.max(min, v * k));
    const used = hs.reduce((a, b) => a + b, 0) + gapPx * (hs.length - 1);
    let y = props.y + (props.h - used) / 2;
    return hs.map((h) => {
      const s = { y, h };
      y += h + gapPx;
      return s;
    });
  };
  const ins = side(props.inputs);
  const outs = side([...props.outputs, props.fee]);
  const stemTop = props.y + (props.h - props.stem) / 2;
  const cx = props.x + props.w / 2;
  const left = props.x + bar;
  const right = props.x + props.w - bar;
  let fromStem = stemTop;
  let toStem = stemTop;
  const feeColor = feeHex(props.band);
  return (
    <g>
      {ins.map((s) => {
        const h = s.h;
        const d = ribbon(left, s.y, s.y + h, cx - 4, toStem, toStem + Math.min(h, props.stem));
        toStem += Math.min(h, props.stem);
        return <path d={d} fill={props.pal.ribbon} />;
      })}
      {outs.map((s, i) => {
        const isFee = i === outs.length - 1;
        const share = isFee ? Math.max(min, props.fee * k) : s.h;
        const d = ribbon(cx + 4, fromStem, fromStem + share, right, s.y, s.y + s.h);
        fromStem += share;
        return <path d={d} fill={isFee ? feeColor : props.pal.ribbon} />;
      })}
      <rect
        x={cx - 5}
        y={stemTop - 2}
        width={10}
        height={props.stem + min + 4}
        rx="5"
        fill={props.pal.lineStrong}
      />
      {ins.map((s) => (
        <rect x={props.x} y={s.y} width={bar} height={s.h} rx="3" fill={props.pal.lineStrong} />
      ))}
      {outs.map((s, i) => (
        <rect
          x={right}
          y={s.y}
          width={bar}
          height={s.h}
          rx="3"
          fill={i === outs.length - 1 ? feeColor : props.pal.lineStrong}
        />
      ))}
    </g>
  );
}

/** A balance as steps held to `until`, on an axis cut to the range it covers. */
export function Steps(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  steps: readonly [number, number][];
  until: number;
  color: string;
  width: number;
}) {
  const t0 = props.steps[0]?.[0] ?? 0;
  const vs = props.steps.map(([, v]) => v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const xAt = (t: number) => props.x + ((t - t0) / (props.until - t0)) * props.w;
  const yAt = (v: number) => props.y + props.h - ((v - lo) / (hi - lo || 1)) * props.h;
  let d = "";
  for (const [i, [t, v]] of props.steps.entries()) {
    d += i === 0 ? `M${xAt(t)} ${yAt(v)}` : `H${xAt(t)}V${yAt(v)}`;
  }
  d += `H${xAt(props.until)}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={props.color}
      stroke-width={props.width}
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  );
}

/** Where the lowest point of a balance falls, for its label. */
export function lowest(steps: readonly [number, number][], x: number, w: number, until: number) {
  const t0 = steps[0]?.[0] ?? 0;
  let best: [number, number] = steps[0] ?? [0, 0];
  for (const s of steps) if (s[1] < best[1]) best = s;
  return { x: x + ((best[0] - t0) / (until - t0)) * w, value: best[1] };
}

export function highest(steps: readonly [number, number][]) {
  return Math.max(...steps.map(([, v]) => v));
}
