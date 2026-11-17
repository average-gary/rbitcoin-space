// MOCKUP, never merged: a redesigned mempool history page for the owner to look at, drawn from
// answers recorded once from the public site (samples/), so it needs no server.
import { useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onSettled,
  Show,
} from "solid-js";
import {
  areaPath,
  extent,
  type Join,
  layerAt,
  linePath,
  nearestIndex,
  stackLayout,
} from "../../components/chart/geometry";
import { endLabels, formatSi, linearAxis, scale, timeTicks } from "../../components/chart/scale";
import { More } from "../../components/More";
import { Periods } from "../../components/Periods";
import { FEE_KEY_BOUNDS, formatFeeRate, formatSize, groupDigits } from "../../lib/format";
import { usePageTitle } from "../../lib/page";
import {
  coverageSentence,
  dataFrom,
  type History,
  INTERVALS,
  type Interval,
  parseInterval,
  pointTime,
  rateText,
  seriesOf,
} from "../mempool/history";
import { bandName, figures, flowPoints, fromColumns, layersFrom } from "./model";
import "./MockMempoolHistory.css";

const SAMPLES: Record<string, () => Promise<{ default: unknown }>> = {
  "2h": () => import("./samples/2h.json"),
  "24h": () => import("./samples/24h.json"),
  "1w": () => import("./samples/1w.json"),
  "1m": () => import("./samples/1m.json"),
  "3m": () => import("./samples/3m.json"),
  "6m": () => import("./samples/6m.json"),
  "1y": () => import("./samples/1y.json"),
  "2y": () => import("./samples/2y.json"),
  "3y": () => import("./samples/3y.json"),
  "4y": () => import("./samples/4y.json"),
  all: () => import("./samples/all.json"),
};

const href = (id?: string) =>
  id === undefined ? "/mock/mempool-history" : `/mock/mempool-history?interval=${id}`;

export default function MockMempoolHistory() {
  usePageTitle(() => "Mempool history (mockup)");
  const [search] = useSearchParams();
  const interval = createMemo(() => parseInterval(search["interval"]));
  const [answer, setAnswer] = createSignal<{ id: string; h: History }>();
  createEffect(
    () => interval().id,
    (id) => {
      void SAMPLES[id]?.().then((m) =>
        setAnswer({ id, h: fromColumns(m.default as Parameters<typeof fromColumns>[0]) }),
      );
    },
  );
  return (
    <div class="wrap mh">
      <header class="mh-head">
        <h1>Mempool history</h1>
        <Show when={answer()}>
          {(a) => (
            <Show when={coverageSentence(a().h, a().h.to)}>
              {(text) => <p class="mh-coverage">{text()}</p>}
            </Show>
          )}
        </Show>
        <Periods choices={INTERVALS} current={interval().id} href={href} fitted={false} />
      </header>
      <Show when={answer()} fallback={<div class="mh-slot" />}>
        {(a) => <Board h={a().h} interval={interval()} />}
      </Show>
      <More>
        <p>
          The layers are what waits, by fee rate, cheapest at the bottom. Pick a band in the key to
          see it and every dearer band alone, on its own scale.
        </p>
        <p>
          Flow: the line is what arrived, the shade what blocks mined and what left otherwise
          (replaced, expired or evicted). Line above the shade: the mempool is filling. Under two
          hours a point a minute holds a block or none, so flow reads in ten-minute means.
        </p>
        <p>
          “Next block reaches” is the cheapest band the dearest 1 MvB waiting reaches into, at the
          latest minute. A break in the layers is time this server was not recording.
        </p>
      </More>
    </div>
  );
}

const PHONE = "(max-width: 40em)";

function Board(props: { h: History; interval: Interval }) {
  const f = () => figures(props.h);
  return (
    <section class="mh-board" aria-label="The mempool over the period">
      <Show when={f()}>
        {(fig) => (
          <dl class="mh-figures">
            <div class="mh-fig">
              <dt>Waiting now</dt>
              <dd class="mh-fig__value num">{formatSize(fig().last.vsize)}</dd>
              <dd class="mh-fig__sub num">{groupDigits(fig().last.count)} transactions</dd>
            </div>
            <div class="mh-fig">
              <dt>Change</dt>
              <dd class="mh-fig__value num">
                {fig().change >= 0 ? "+" : "−"}
                {formatSize(Math.abs(fig().change))}
              </dd>
              <dd class="mh-fig__sub num">peak {formatSize(fig().peak.vsize)}</dd>
            </div>
            <div class="mh-fig">
              <dt>Arriving</dt>
              <dd class="mh-fig__value num">{rateText(fig().flow?.entered ?? 0)}</dd>
              <dd class="mh-fig__sub num">blocks took {rateText(fig().flow?.mined ?? 0)}</dd>
            </div>
            <div class="mh-fig">
              <dt>Next block reaches</dt>
              <dd class="mh-fig__value num">
                {fig().deep === -1
                  ? "Everything"
                  : fig().deep === 0
                    ? `${formatFeeRate(fig().last.min_fee_rate / 1000)} sat/vB`
                    : `${FEE_KEY_BOUNDS[fig().deep] ?? ""} sat/vB`}
              </dd>
              <dd class="mh-fig__sub">
                {fig().deep === -1 ? "under a block waiting" : "the dearest 1 MvB, now"}
              </dd>
            </div>
          </dl>
        )}
      </Show>
      <Plot h={props.h} interval={props.interval} />
    </section>
  );
}

function Plot(props: { h: History; interval: Interval }) {
  const id = createUniqueId();
  const phoneQuery = typeof matchMedia === "function" ? matchMedia(PHONE) : undefined;
  const [phone, setPhone] = createSignal(phoneQuery?.matches === true);
  const [width, setWidth] = createSignal(0);
  /** The point under the pointer; undefined reads the latest. */
  const [picked, setPicked] = createSignal<number>();
  const [hover, setHover] = createSignal(-1);
  /** The cheapest band shown; 0 shows them all. */
  const [floor, setFloor] = createSignal(0);
  let box: HTMLDivElement | undefined;

  onSettled(() => {
    const change = (e: MediaQueryListEvent) => setPhone(e.matches);
    phoneQuery?.addEventListener("change", change);
    if (!box) return () => phoneQuery?.removeEventListener("change", change);
    const el = box;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => {
      ro.disconnect();
      phoneQuery?.removeEventListener("change", change);
    };
  });

  const all = createMemo(() => seriesOf(props.h));
  const flow = createMemo(() => flowPoints(props.h));

  const frame = createMemo(() => {
    const w = width();
    const h = props.h;
    if (w <= 0 || h.points.length === 0) return undefined;
    const narrow = phone();
    const ml = narrow ? 44 : 56;
    const mr = 6;
    const sizeTop = 8;
    const sizeBottom = sizeTop + (narrow ? 210 : 330);
    const flowTop = sizeBottom + 44;
    const flowBottom = flowTop + (narrow ? 72 : 112);
    const height = flowBottom + 22;
    const L = layersFrom(h, floor());
    const n = L.x.length;
    const stack = stackLayout(
      L.layers.map((l) => l.values),
      n,
    );
    const tops = stack.at(-1)?.hi ?? [];
    const yAxis = linearAxis(0, extent(tops)?.[1] ?? 1, narrow ? 3 : 5, true);
    const sx = scale([h.from, h.to], [ml, w - mr]);
    const sy = scale(yAxis.domain, [sizeBottom, sizeTop]);
    // Each join's values stacked as the layers are, so a layer arrives and leaves on an edge.
    const cum = (vs: readonly number[]) => {
      let acc = 0;
      return vs.map((v) => {
        const lo = acc;
        acc += v;
        return { lo, hi: acc };
      });
    };
    const joinMaps = L.layers.map((_, k) => {
      const m = new Map<number, Join>();
      for (const j of L.joins) {
        m.set(j.index, {
          in: j.before ? cum(j.before)[k] : undefined,
          out: j.after ? cum(j.after)[k] : undefined,
        });
      }
      return m;
    });
    // Up to five missing minutes are bridged, as on the real page; a longer pause breaks.
    const gap = h.step * 6;
    const layers = stack.map((l, k) => ({
      band: L.layers[k]?.band ?? 0,
      d: areaPath(L.x, l.hi, l.lo, sx, sy, gap, 1.5, joinMaps[k]),
    }));

    const F = flow();
    const fgap = F.step === h.step ? gap : F.step * 1.5;
    const outTop = F.mined.map((m, i) => m + (F.other[i] ?? 0));
    const fAxis = linearAxis(0, extent(F.entered, outTop)?.[1] ?? 1, 2, true);
    const fy = scale(fAxis.domain, [flowBottom, flowTop]);
    const room = w - ml - mr;
    const ticks = narrow ? undefined : timeTicks(h.from, h.to, Math.floor(room / 96));
    const from = dataFrom(h);
    return {
      w,
      height,
      ml,
      mr,
      sizeTop,
      sizeBottom,
      flowTop,
      flowBottom,
      x: L.x,
      stack,
      layers,
      sx,
      sy,
      yTicks: yAxis.ticks,
      fy,
      fTicks: fAxis.ticks,
      mined: areaPath(F.x, F.mined, 0, sx, fy, fgap, 1.5, undefined, true),
      other: areaPath(F.x, outTop, F.mined, sx, fy, fgap, 1.5, undefined, true),
      entered: linePath(F.x, F.entered, sx, fy, fgap, true),
      ticks: ticks ? ticks.ticks.map((t) => ({ x: sx(t), label: ticks.label(t) })) : undefined,
      ends: endLabels(h.from, h.to, room),
      hatch: from === undefined ? undefined : { x: sx(h.from), w: sx(from) - sx(h.from) },
    };
  });

  const index = () => picked() ?? props.h.points.length - 1;
  const point = () => props.h.points[index()];
  const flowIndex = () => {
    const p = point();
    const F = flow();
    return p ? nearestIndex(F.x, Math.floor(p.time / F.step) * F.step) : -1;
  };
  const hoverBand = () => frame()?.layers[hover()]?.band ?? -2;

  const pick = (e: PointerEvent) => {
    const f = frame();
    if (!f) return;
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const i = nearestIndex(f.x, f.sx.invert(e.clientX - r.left));
    setPicked(i);
    const y = e.clientY - r.top;
    setHover(y >= f.sizeTop && y <= f.sizeBottom ? layerAt(f.stack, i, f.sy.invert(y)) : -1);
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setPicked(undefined);
    setHover(-1);
  };
  const key = (e: KeyboardEvent) => {
    const n = props.h.points.length;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageUp: -10,
      PageDown: 10,
    };
    const by = moves[e.key];
    if (by !== undefined) setPicked(Math.max(0, Math.min(n - 1, index() + by)));
    else if (e.key === "Home") setPicked(0);
    else if (e.key === "End") setPicked(undefined);
    else return;
    e.preventDefault();
  };
  const time = () => pointTime(props.h.step);
  const bandValue = (k: number) =>
    k === -1 ? (all().unsplit?.[index()] ?? 0) : (all().bands[k]?.[index()] ?? 0);
  const rows = () => [
    ...Array.from({ length: 12 }, (_, i) => 11 - i),
    ...(all().unsplit && floor() === 0 && bandValue(-1) > 0 ? [-1] : []),
  ];
  /** The first band above the cheap bulk: where nine tenths of the latest minute lie below. */
  const bulk = () => {
    const last = props.h.points.at(-1);
    if (!last) return 0;
    const b = all().bands.map((v) => v.at(-1) ?? 0);
    let below = all().unsplit?.at(-1) ?? 0;
    for (let k = 0; k < b.length; k++) {
      if (below >= last.vsize * 0.9) return k;
      below += b[k] ?? 0;
    }
    return 0;
  };
  const shown = () => {
    const p = point();
    if (!p) return 0;
    return rows().reduce((s, k) => (k === -1 || k >= floor() ? s + bandValue(k) : s), 0);
  };

  return (
    <div class="mh-plot">
      <div class="mh-now" aria-live="off">
        <Show when={point()}>
          {(p) => (
            <>
              <span class="mh-now__when">{time()(p().time)}</span>
              <span class="mh-now__total num">
                {formatSize(shown())}
                <Show when={floor() > 0}>
                  <span class="mh-now__of"> of {formatSize(p().vsize)}</span>
                </Show>
              </span>
              <span class="mh-now__more num">
                {groupDigits(Math.round(p().count))} tx, from{" "}
                {formatFeeRate(p().min_fee_rate / 1000)} sat/vB
              </span>
            </>
          )}
        </Show>
      </div>
      <div
        class="mh-canvas"
        ref={box}
        tabindex="0"
        role="slider"
        aria-label={`The mempool by fee rate and its flow, ${props.interval.words}`}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, props.h.points.length - 1)}
        aria-valuenow={index()}
        aria-valuetext={point() ? `${time()(point()?.time ?? 0)}, ${formatSize(shown())}` : ""}
        onKeyDown={key}
        style={{ "--h": `${frame()?.height ?? 300}px` }}
      >
        <Show when={frame()}>
          {(f) => (
            <svg
              width={f().w}
              height={f().height}
              viewBox={`0 0 ${f().w} ${f().height}`}
              aria-hidden="true"
              onPointerMove={pick}
              onPointerDown={pick}
              onPointerLeave={leave}
            >
              <defs>
                <pattern
                  id={`${id}-hatch`}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line class="mh-hatch" x1="0" y1="0" x2="0" y2="6" />
                </pattern>
              </defs>
              <For each={f().yTicks}>
                {(t) => (
                  <g>
                    <line
                      class="mh-grid"
                      x1={f().ml}
                      x2={f().w - f().mr}
                      y1={Math.round(f().sy(t)) + 0.5}
                      y2={Math.round(f().sy(t)) + 0.5}
                    />
                    <text class="mh-label" x={f().ml - 6} y={f().sy(t) + 4} text-anchor="end">
                      {formatSi(t, "vB")}
                    </text>
                  </g>
                )}
              </For>
              <For each={f().fTicks}>
                {(t) => (
                  <g>
                    <line
                      class="mh-grid"
                      x1={f().ml}
                      x2={f().w - f().mr}
                      y1={Math.round(f().fy(t)) + 0.5}
                      y2={Math.round(f().fy(t)) + 0.5}
                    />
                    <text class="mh-label" x={f().ml - 6} y={f().fy(t) + 4} text-anchor="end">
                      {formatSi(t, "")}
                    </text>
                  </g>
                )}
              </For>
              <text class="mh-strip" x={f().ml} y={f().flowTop - 12}>
                Flow, vB/s: arrived and left
              </text>
              <Show when={f().hatch}>
                {(hz) => (
                  <>
                    <rect
                      x={hz().x}
                      y={f().sizeTop}
                      width={Math.max(0, hz().w)}
                      height={f().sizeBottom - f().sizeTop}
                      fill={`url(#${id}-hatch)`}
                    />
                    <rect
                      x={hz().x}
                      y={f().flowTop}
                      width={Math.max(0, hz().w)}
                      height={f().flowBottom - f().flowTop}
                      fill={`url(#${id}-hatch)`}
                    />
                    <Show when={hz().w > 90}>
                      <text class="mh-label" x={hz().x + 8} y={f().sizeTop + 16}>
                        Not recorded
                      </text>
                    </Show>
                  </>
                )}
              </Show>
              <For each={f().layers}>
                {(l, k) => (
                  <path
                    class={["mh-layer", { "mh-layer--on": hover() === k() }]}
                    style={{ fill: l.band === -1 ? "var(--fee-1)" : `var(--fee-${l.band + 1})` }}
                    d={l.d}
                  />
                )}
              </For>
              <path class="mh-flow-mined" d={f().mined} />
              <path class="mh-flow-other" d={f().other} />
              <path class="mh-flow-in" d={f().entered} />
              <line
                class="mh-axis"
                x1={f().ml}
                x2={f().w - f().mr}
                y1={f().sizeBottom + 0.5}
                y2={f().sizeBottom + 0.5}
              />
              <line
                class="mh-axis"
                x1={f().ml}
                x2={f().w - f().mr}
                y1={f().flowBottom + 0.5}
                y2={f().flowBottom + 0.5}
              />
              <Show
                when={f().ticks}
                fallback={
                  <>
                    <text class="mh-label" x={f().ml} y={f().height - 4}>
                      {f().ends[0]}
                    </text>
                    <text class="mh-label" x={f().w - f().mr} y={f().height - 4} text-anchor="end">
                      {f().ends[1]}
                    </text>
                  </>
                }
              >
                {(ts) => (
                  <For each={ts()}>
                    {(t) => (
                      <text class="mh-label" x={t.x} y={f().height - 4} text-anchor="middle">
                        {t.label}
                      </text>
                    )}
                  </For>
                )}
              </Show>
              <Show when={point()}>
                {(p) => (
                  <line
                    class="mh-cross"
                    x1={Math.round(f().sx(p().time)) + 0.5}
                    x2={Math.round(f().sx(p().time)) + 0.5}
                    y1={f().sizeTop}
                    y2={f().flowBottom}
                  />
                )}
              </Show>
            </svg>
          )}
        </Show>
      </div>
      <div class="mh-keys">
        <div class="mh-keys__head">
          <span>By fee rate, sat/vB</span>
          <Show
            when={floor() > 0}
            fallback={
              <Show when={bulk() > 0}>
                <button type="button" class="mh-keys__all" onClick={() => setFloor(bulk())}>
                  From {FEE_KEY_BOUNDS[bulk()]} up
                </button>
              </Show>
            }
          >
            <button type="button" class="mh-keys__all" onClick={() => setFloor(0)}>
              Show all
            </button>
          </Show>
        </div>
        <ul class="mh-bands">
          <For each={rows()}>
            {(k) => (
              <li>
                <button
                  type="button"
                  class={[
                    "mh-band",
                    {
                      "mh-band--off": k !== -1 && k < floor(),
                      "mh-band--on": hoverBand() === k,
                      "mh-band--empty": bandValue(k) === 0,
                    },
                  ]}
                  aria-pressed={floor() > 0 && k === floor() ? "true" : "false"}
                  title={k <= 0 ? "Show every band" : `Show ${bandName(k)} sat/vB and dearer`}
                  onClick={() => setFloor(k <= 0 || floor() === k ? 0 : k)}
                >
                  <span
                    class="mh-swatch"
                    style={{ background: k === -1 ? "var(--fee-1)" : `var(--fee-${k + 1})` }}
                  />
                  <span class="mh-band__name">
                    {k === -1 ? "under 0.2, not split" : bandName(k)}
                  </span>
                  <span class="mh-band__value num">{formatSize(bandValue(k))}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
        <Show when={flow().x[flowIndex()] !== undefined}>
          <ul class="mh-flowkey">
            <li>
              <span class="mh-key mh-key--in" />
              Arrived
              <span class="num">{rateText(flow().entered[flowIndex()] ?? 0)}</span>
            </li>
            <li>
              <span class="mh-key mh-key--mined" />
              Mined
              <span class="num">{rateText(flow().mined[flowIndex()] ?? 0)}</span>
            </li>
            <li>
              <span class="mh-key mh-key--other" />
              Left otherwise
              <span class="num">{rateText(flow().other[flowIndex()] ?? 0)}</span>
            </li>
          </ul>
        </Show>
      </div>
    </div>
  );
}
