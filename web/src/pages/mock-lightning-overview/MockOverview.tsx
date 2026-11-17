// A mockup of a denser Lightning overview for node operators, drawn from recorded mainnet answers
// (sample.ts). A design proposal, never shipped: it changes nothing the real page uses.
import { useLocation, useSearchParams } from "@solidjs/router";
import {
  createMemo,
  createSignal,
  For,
  lazy,
  Loading as Pending,
  Match,
  Show,
  Switch,
} from "solid-js";
import { Amount } from "../../components/Amount";
import { sorted } from "../../components/chart/geometry";
import { formatDay, formatMoment } from "../../components/chart/scale";
import { type Column, DataTable } from "../../components/DataTable";
import { Link } from "../../components/Link";
import { More } from "../../components/More";
import { Periods } from "../../components/Periods";
import { SectionHeader } from "../../components/SectionHeader";
import { Empty } from "../../components/States";
import { TimeAgo } from "../../components/Time";
import { useNow } from "../../lib/clock";
import { formatBtcShort, formatUtc, groupDigits } from "../../lib/format";
import { paths } from "../../lib/network";
import { usePageTitle } from "../../lib/page";
import {
  type DayCloses,
  drawnDays,
  type FeedEvent,
  type Mover,
  moversFor,
} from "../lightning/feed";
import {
  ageShort,
  CLOSE_KINDS,
  changeShown,
  dataFrom,
  type Fees,
  inboundOf,
  INTERVALS,
  KIND_SHORT,
  KIND_TAG,
  msat,
  plus,
  ppm,
  type RankedNode,
  type Series,
  type Stats,
} from "../lightning/lightning";
import {
  ChannelLink,
  closesInWords,
  InboundFig,
  LightningNav,
  MsatFig,
  NodeName,
  PpmFig,
  Tag,
  VERIFIED_NOTE,
} from "../lightning/parts";
import { closes, feed, movers, overview, series as allSeries } from "./sample";
import "./MockOverview.css";

const Chart = lazy(() => import("../../components/chart/Chart"));

const PERIODS = [INTERVALS[0], INTERVALS[1], INTERVALS[2]] as const;
type Period = (typeof PERIODS)[number];

/** "12 Nov": the year only when it is not this one. */
const day = (t: number) => formatDay(t).replace(` ${new Date().getUTCFullYear()}`, "");
const btc = (sats: number) => `${formatBtcShort(sats)} BTC`;

interface Figure {
  key: keyof Stats;
  label: string;
  fmt: (n: number) => string;
  axis: (n: number) => string;
  unit?: string;
  /** The mean beside a median, in the chart's readout. */
  mean?: { key: keyof Stats; fmt: (n: number) => string };
}
type FigureKey = keyof Stats;

/** The figures across the top. Each is also the chart's choice: the pressed one is drawn below. */
const FIGURES: readonly [Figure, ...Figure[]] = [
  { key: "channels", label: "Channels", fmt: groupDigits, axis: groupDigits },
  { key: "nodes", label: "Nodes", fmt: groupDigits, axis: groupDigits },
  { key: "capacity", label: "Capacity", fmt: btc, axis: formatBtcShort, unit: "BTC" },
  {
    key: "med_capacity",
    label: "Median channel",
    fmt: btc,
    axis: formatBtcShort,
    unit: "BTC",
    mean: { key: "avg_capacity", fmt: btc },
  },
  {
    key: "med_fee_rate",
    label: "Median fee rate",
    fmt: ppm,
    axis: groupDigits,
    unit: "ppm",
    mean: { key: "avg_fee_rate", fmt: ppm },
  },
  {
    key: "med_base_fee_msat",
    label: "Median base fee",
    fmt: msat,
    axis: groupDigits,
    unit: "msat",
    mean: { key: "avg_base_fee_msat", fmt: msat },
  },
];

export default function MockOverview() {
  usePageTitle(() => "Lightning overview (mockup)");
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const period = createMemo(
    (): Period => PERIODS.find((p) => p.id === search["interval"]) ?? PERIODS[1],
  );
  const figure = createMemo(
    (): Figure => FIGURES.find((f) => f.key === search["figure"]) ?? FIGURES[0],
  );
  const href = (id?: string) => {
    const q = new URLSearchParams();
    if (id !== undefined) q.set("interval", id);
    const f = search["figure"];
    if (typeof f === "string") q.set("figure", f);
    return `${location.pathname}?${q.toString()}`;
  };
  const stats = overview.statistics;
  const s = () => allSeries[period().id];
  return (
    <div class="wrap lnx">
      <LightningNav here="overview" />
      <header class="lnx-head">
        <h1>Lightning</h1>
        <Show when={stats}>{(st) => <p class="lnx-asof">As of {formatMoment(st().time)}</p>}</Show>
        <div class="lnx-head__periods">
          <Periods choices={PERIODS} current={period().id} fitted={false} href={href} />
        </div>
      </header>
      <Show when={stats}>
        {(st) => (
          <Figures
            stats={st()}
            series={s()}
            period={period()}
            current={figure().key}
            pick={(key) => setSearch({ figure: key }, { replace: true, scroll: false })}
          />
        )}
      </Show>
      <div class="lnx-row lnx-row--chart">
        <History series={s()} period={period()} figure={figure()} />
        <ClosesSection first={s().first} />
      </div>
      <div class="lnx-row lnx-row--feed">
        <Feed />
        <MoversSection period={period()} />
      </div>
      <NodeLists period={period()} />
    </div>
  );
}

/** When the period reaches back before the record, the moment its changes are measured from. */
function recordStart(period: Period, s: Series): number | undefined {
  if (overview.before?.[period.id]) return undefined;
  return s.points[0]?.time;
}

/** The value at the period's start: the server's own `before`, else the series' first point. */
function startOf(
  key: FigureKey,
  period: Period,
  series: Series,
): { value: number; since?: number } | undefined {
  const before = overview.before?.[period.id];
  if (before && key in before) return { value: (before as Partial<Stats>)[key] ?? 0 };
  const first = series.points[0];
  if (first === undefined) return undefined;
  return { value: first[key], since: first.time };
}

function Figures(props: {
  stats: Stats;
  series: Series;
  period: Period;
  current: FigureKey;
  pick: (key: FigureKey) => void;
}) {
  const reach = () => {
    const s = props.stats;
    return [
      { name: "Clearnet", n: s.clearnet_nodes, cls: "lnx-reach--clear" },
      { name: "Clearnet and Tor", n: s.clearnet_tor_nodes, cls: "lnx-reach--both" },
      { name: "Tor", n: s.tor_nodes, cls: "lnx-reach--tor" },
      { name: "No address", n: s.unannounced_nodes, cls: "lnx-reach--none" },
    ];
  };
  const pct = (n: number) => `${Math.round((n / props.stats.nodes) * 100)}%`;
  return (
    <section class="panel lnx-now" aria-label="The network now">
      <div class="lnx-figs" role="group" aria-label="Figures; the pressed one is charted below">
        <For each={FIGURES}>
          {(f) => {
            const start = () => startOf(f.key, props.period, props.series);
            const change = () => {
              const st = start();
              if (st === undefined) return "";
              const d = props.stats[f.key] - st.value;
              const words = d === 0 ? "No change" : `${d > 0 ? "↑" : "↓"} ${f.fmt(Math.abs(d))}`;
              return words;
            };
            return (
              <button
                type="button"
                class="lnx-fig"
                aria-pressed={props.current === f.key ? "true" : "false"}
                onClick={() => props.pick(f.key)}
              >
                <span class="lnx-fig__label">{f.label}</span>
                <span class="lnx-fig__value num">
                  <Show
                    when={f.key === "capacity" || f.key === "med_capacity"}
                    fallback={f.fmt(props.stats[f.key])}
                  >
                    <Amount sats={props.stats[f.key]} short />
                  </Show>
                </span>
                <span class="lnx-fig__change num">{change()}</span>
                <Spark series={props.series} pick={(p) => p[f.key]} />
              </button>
            );
          }}
        </For>
      </div>
      <Show when={recordStart(props.period, props.series)}>
        {(t) => <p class="lnx-aside">Changes since {day(t())}, when the record began.</p>}
      </Show>
      <div class="lnx-reach">
        <span class="lnx-reach__label">Nodes reached by</span>
        <span class="lnx-reach__bar" aria-hidden="true">
          <For each={reach()}>
            {(r) => <span class={r.cls} style={{ "flex-grow": String(r.n) }} />}
          </For>
        </span>
        <ul class="lnx-reach__key">
          <For each={reach()}>
            {(r) => (
              <li>
                <span class={`lnx-reach__sw ${r.cls}`} aria-hidden="true" />
                {r.name} <span class="num">{pct(r.n)}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
      <More>
        <p>
          {VERIFIED_NOTE} Fee figures are over {groupDigits(props.stats.policies)} policies. A
          change compares now with the period's start, or with the first record when the record is
          shorter.
        </p>
      </More>
    </section>
  );
}

/** The period's trend in a tile: its whole width, blank before the record, broken at long gaps. */
function Spark(props: { series: Series; pick: (p: Stats) => number }) {
  const W = 120;
  const H = 28;
  const d = createMemo(() => {
    const { from, to, step, points } = props.series;
    const vs = points.map((p) => props.pick(p));
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const y = (v: number) => (hi === lo ? H / 2 : H - 2 - ((v - lo) / (hi - lo)) * (H - 4));
    const x = (t: number) => ((t - from) / (to - from)) * W;
    let path = "";
    let last: number | undefined;
    points.forEach((p, i) => {
      // Up to five missing steps are bridged, as the charts do; a longer pause breaks the line.
      const move = last === undefined || p.time - last > step * 6;
      path += `${move ? "M" : "L"}${x(p.time).toFixed(1)} ${y(vs[i] ?? 0).toFixed(1)}`;
      last = p.time;
    });
    return path;
  });
  // Before the record, hatched as the charts hatch it: unknown, not flat.
  const none = () => {
    const { from, to, points } = props.series;
    const first = points[0]?.time ?? to;
    return Math.max(0, ((first - from) / (to - from)) * 100);
  };
  return (
    <span class="lnx-spark" aria-hidden="true">
      <Show when={none() > 1}>
        <span class="lnx-spark__none" style={{ width: `${none()}%` }} />
      </Show>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={d()} />
      </svg>
    </span>
  );
}

function History(props: { series: Series; period: Period; figure: Figure }) {
  const f = () => props.figure;
  const col = (key: keyof Stats) => props.series.points.map((p) => p[key]);
  return (
    <section id="history" class="lnx-history" aria-labelledby="lnx-history-title">
      <SectionHeader title={`${f().label}, over time`} id="lnx-history-title">
        <Show when={dataFrom(props.series)} fallback="Every ten minutes">
          {(t) => <>Recorded from {day(t())}</>}
        </Show>
      </SectionHeader>
      <div class="lnx-chart">
        <Pending>
          <Chart
            label={`Lightning ${f().label.toLowerCase()}, ${props.period.words}`}
            x={props.series.points.map((p) => p.time)}
            domain={[props.series.from, props.series.to]}
            dataFrom={dataFrom(props.series)}
            gap={props.series.step}
            height={220}
            left={{ format: f().axis }}
            series={[
              {
                name: f().label,
                values: col(f().key),
                draw: "line",
                format: f().axis,
                ...(f().unit === undefined ? {} : { unit: f().unit }),
                marks: true,
              },
            ]}
            notes={(() => {
              const m = f().mean;
              return m === undefined ? [] : [{ name: "Mean", values: col(m.key), format: m.fmt }];
            })()}
            time={formatMoment}
          />
        </Pending>
      </div>
    </section>
  );
}

const total = (d: DayCloses) => d.cooperative + d.force + d.penalty + d.other;
function barTop(most: number): number {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, most))));
  return ([2, 4, 6, 8, 10].find((m) => m * p >= most) ?? 10) * p;
}

/** A bar a day, its kinds stacked; the pointer over a day reads it out. As the live page's. */
function ClosesSection(props: { first: number | null }) {
  const c = closes;
  const [at, setAt] = createSignal<number>();
  const days = createMemo(() => drawnDays(c.days, props.first));
  const d = () => days()[at() ?? days().length - 1];
  const unknown = (x: DayCloses) => props.first !== null && x.time + 86_400 <= props.first;
  const top = () => barTop(Math.max(0, ...days().map((x) => total(x))));
  const shown = (k: (typeof CLOSE_KINDS)[number]) => {
    const x = d();
    return x === undefined || unknown(x) ? "–" : groupDigits(x[k]);
  };
  return (
    <section class="lnx-closes" aria-labelledby="lnx-closes-title">
      <SectionHeader title="Closes by kind" id="lnx-closes-title">
        Each day, UTC
      </SectionHeader>
      <p class="lnx-bars__readout">
        <strong class="num">{d() ? day(d()?.time ?? 0) : ""}</strong>
        <For each={CLOSE_KINDS}>
          {(k) => (
            <span class="lnx-bars__key">
              <span class={`lnx-bars__sw ln-close-${k}`} aria-hidden="true" />
              {KIND_SHORT[k]} <span class="num">{shown(k)}</span>
            </span>
          )}
        </For>
        <span class="lnx-bars__key num">{d() ? btc(d()?.capacity ?? 0) : ""}</span>
      </p>
      <div class="lnx-bars" aria-hidden="true">
        <span class="lnx-bars__axis num">
          <span>{groupDigits(top())}</span>
          <span>0</span>
        </span>
        <div
          class="lnx-bars__plot"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.floor(((e.clientX - r.left) / r.width) * days().length);
            setAt(Math.max(0, Math.min(days().length - 1, i)));
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setAt(undefined);
          }}
        >
          <For each={days()}>
            {(x, i) => (
              <span
                class={[
                  "lnx-bars__day",
                  { "lnx-bars__day--at": at() === i(), "lnx-bars__day--unknown": unknown(x) },
                ]}
              >
                <For each={CLOSE_KINDS}>
                  {(k) => (
                    <Show when={x[k] > 0}>
                      <span
                        class={`lnx-bars__seg ln-close-${k}`}
                        style={{ "--h": String(x[k] / top()) }}
                      />
                    </Show>
                  )}
                </For>
              </span>
            )}
          </For>
        </div>
      </div>
      <p class="lnx-bars__ends num" aria-hidden="true">
        <span>{day(days()[0]?.time ?? 0)}</span>
        <span>{day(days().at(-1)?.time ?? 0)}</span>
      </p>
      <p class="lnx-aside">
        Since {day(props.first ?? c.days[0]?.time ?? 0)}: {closesInWords(c.total)},{" "}
        <span class="num">{btc(c.total.capacity)}</span>.{" "}
        <Link class="tap" href={paths.lightningPenalties()}>
          Penalties
        </Link>
      </p>
      <More label="Show the figures">
        <DataTable
          caption="Closes each day by kind"
          columns={[
            { header: "Day", cell: (x: DayCloses) => day(x.time) },
            ...CLOSE_KINDS.map((k): Column<DayCloses> => ({
              header: KIND_SHORT[k],
              numeric: true,
              cell: (x) => (unknown(x) ? "–" : groupDigits(x[k])),
            })),
          ]}
          rows={sorted(days(), (a, b) => b.time - a.time)}
        />
      </More>
    </section>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "opened", label: "Opens" },
  { id: "closed", label: "Closes" },
  { id: "fee", label: "Fee changes" },
] as const;
const CLOSE_WORD = {
  cooperative: "Cooperative close",
  force: "Force close",
  penalty: "Penalty",
  other: "Other close",
} as const;

/** The live feed, from the recorded snapshot: one line of facts a row, its two ends beside them. */
function Feed() {
  const [filter, setFilter] = createSignal<(typeof FILTERS)[number]["id"]>("all");
  const events = sorted(feed, (a, b) => b.time - a.time);
  const view = () => (filter() === "all" ? events : events.filter((e) => e.event === filter()));
  return (
    <section class="lnx-feed" aria-labelledby="lnx-feed-title">
      <SectionHeader title="As it happens" id="lnx-feed-title">
        <span class="ln-live">
          <span class="ln-live__dot" aria-hidden="true" />
          Live
        </span>
      </SectionHeader>
      <div class="ln-picker" role="group" aria-label="Show">
        <ul>
          <For each={FILTERS}>
            {(f) => (
              <li>
                <button
                  type="button"
                  class="ln-picker__item"
                  aria-pressed={filter() === f.id ? "true" : "false"}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
      <ol class="lnx-feed__list" aria-label="Newest first">
        <For each={view()}>{(ev) => <FeedRow ev={ev} />}</For>
      </ol>
    </section>
  );
}

function FeedRow(props: { ev: FeedEvent }) {
  const ev = props.ev;
  const fee = ev.event === "fee" ? ev : undefined;
  const from = () => (fee?.by === "node_two" ? ev.node_two : ev.node_one);
  const to = () => (fee?.by === "node_two" ? ev.node_one : ev.node_two);
  return (
    <li class="lnx-ev">
      <span class="lnx-ev__kind">
        <Switch>
          <Match when={ev.event === "opened"}>
            <Tag icon="plus" tone="positive">
              Opened
            </Tag>
          </Match>
          <Match when={ev.event === "closed" && ev}>
            {(c) => (
              <Tag icon={KIND_TAG[c().kind].icon} tone={KIND_TAG[c().kind].tone}>
                {CLOSE_WORD[c().kind]}
              </Tag>
            )}
          </Match>
          <Match when={fee}>
            <Tag icon="fee" tone="muted">
              Fee change
            </Tag>
          </Match>
        </Switch>
      </span>
      <span class="lnx-ev__id">
        <ChannelLink id={ev.id} />
      </span>
      <span class="lnx-ev__fig">
        <Show when={fee} fallback={<Amount sats={ev.capacity} short />}>
          {(f) => <Moved before={f().before} after={f().after} />}
        </Show>
      </span>
      <span class="lnx-ev__time">
        <TimeAgo time={ev.time} />
      </span>
      <span class="lnx-ev__ends">
        <NodeName node={from()} />
        <span class="lnx-ev__join" aria-hidden="true">
          {fee ? "→" : "↔"}
        </span>
        <span class="visually-hidden">{fee ? "charges towards" : "and"}</span>
        <NodeName node={to()} />
      </span>
    </li>
  );
}

function Moved(props: { before: Fees; after: Fees }) {
  const which = () => changeShown(props);
  const side = (f: Fees) => (
    <Switch>
      <Match when={which() === "rate"}>
        <PpmFig rate={f.fee_rate} />
      </Match>
      <Match when={which() === "base"}>
        <MsatFig msat={f.base_fee_msat} />
      </Match>
      <Match when={inboundOf(f)}>{(i) => <InboundFig fee={i()} />}</Match>
      <Match when={true}>none</Match>
    </Switch>
  );
  return (
    <span class="lnx-moved">
      <Show when={which() === "inbound"}>
        <span class="lnx-muted">Inbound</span>
      </Show>
      <span>{side(props.before)}</span>
      <span aria-hidden="true">→</span>
      <span class="visually-hidden">to</span>
      <span>{side(props.after)}</span>
    </span>
  );
}

const MEASURES = [
  { id: "capacity", label: "Capacity" },
  { id: "channels", label: "Channels" },
] as const;
const WAYS = [
  { id: "gained", label: "Gained" },
  { id: "lost", label: "Lost" },
  { id: "either", label: "Either way" },
] as const;

function MoversSection(props: { period: Period }) {
  const [measure, setMeasure] = createSignal<"capacity" | "channels">("capacity");
  const [way, setWay] = createSignal<"gained" | "lost" | "either">("gained");
  const signed = (r: Mover) => {
    const n = measure() === "capacity" ? r.capacity_change : r.channels_change;
    return measure() === "capacity"
      ? `${plus(n)}${formatBtcShort(n)}`
      : `${n > 0 ? "+" : n < 0 ? "−" : ""}${groupDigits(Math.abs(n))}`;
  };
  const unit = () => (measure() === "capacity" ? "BTC" : "channels");
  const pick = <T extends string>(
    label: string,
    choices: readonly { id: T; label: string }[],
    current: () => T,
    set: (v: T) => void,
  ) => (
    <div class="ln-picker" role="group" aria-label={label}>
      <ul>
        <For each={choices}>
          {(c) => (
            <li>
              <button
                type="button"
                class="ln-picker__item"
                aria-pressed={current() === c.id ? "true" : "false"}
                onClick={() => set(c.id)}
              >
                {c.label}
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
  return (
    <section class="lnx-movers" aria-labelledby="lnx-movers-title">
      <SectionHeader title="Movers" id="lnx-movers-title">
        Net change, {props.period.words}
      </SectionHeader>
      <div class="lnx-controls">
        {pick("Measure", MEASURES, measure, setMeasure)}
        {pick("Which way", WAYS, way, setWay)}
      </div>
      <DataTable
        caption={`Nodes by ${measure()}, ${props.period.words}`}
        columns={[
          { header: "Node", cell: (r: Mover) => <NodeName node={r} /> },
          {
            header: `Change, ${unit()}`,
            short: "Change",
            numeric: true,
            cell: (r: Mover) => <span class="num">{signed(r)}</span>,
          },
          {
            header: `Now, ${unit()}`,
            short: "Now",
            numeric: true,
            cell: (r: Mover) =>
              measure() === "capacity" ? (
                <Amount sats={r.capacity} unit={false} short />
              ) : (
                groupDigits(r.channels)
              ),
          },
        ]}
        rows={moversFor(movers[props.period.id], measure(), way())}
        rowHref={(r) => paths.lightningNode(r.id)}
        empty={<Empty title="No change in this period" />}
      />
    </section>
  );
}

function Ago(props: { time: number | undefined }) {
  const now = useNow();
  return (
    <Show when={props.time} fallback="–">
      {(t) => (
        <span class="num" title={formatUtc(t())}>
          {ageShort(now() - t())}
        </span>
      )}
    </Show>
  );
}

/** Four short lists side by side: who is big, who is connected, who came, who went. */
function NodeLists(props: { period: Period }) {
  const o = overview;
  const m = () => movers[props.period.id];
  const ranked = (by: "capacity" | "channels"): Column<RankedNode>[] => [
    { header: "Node", cell: (n) => <NodeName node={n} /> },
    by === "capacity"
      ? {
          header: "Capacity, BTC",
          short: "BTC",
          numeric: true,
          cell: (n) => <Amount sats={n.capacity} unit={false} short />,
        }
      : { header: "Channels", numeric: true, cell: (n) => groupDigits(n.channels) },
  ];
  const arrivals = (left: boolean): Column<Mover>[] => [
    { header: "Node", cell: (r) => <NodeName node={r} link={!left} /> },
    ...(left
      ? [
          {
            header: "Closed",
            numeric: true,
            cell: (r: Mover) => groupDigits(Math.abs(r.channels_change)),
          },
        ]
      : []),
    {
      header: left ? "Ago" : "First channel",
      ...(left ? {} : { sub: "ago" }),
      numeric: true,
      cell: (r) => <Ago time={r.time} />,
    },
  ];
  const [tab, setTab] = createSignal("cap");
  const TABS = [
    { id: "cap", label: "Largest" },
    { id: "ch", label: "Connected" },
    { id: "new", label: "Newest" },
    { id: "left", label: "Left" },
  ];
  return (
    <div class="lnx-lists" data-show={tab()}>
      {/* A phone shows one list at a time; a wide screen all four, and no picker. */}
      <div class="ln-picker lnx-lists__pick" role="group" aria-label="Nodes">
        <ul>
          <For each={TABS}>
            {(t) => (
              <li>
                <button
                  type="button"
                  class="ln-picker__item"
                  aria-pressed={tab() === t.id ? "true" : "false"}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
      <section data-list="cap" aria-labelledby="lnx-top-cap">
        <SectionHeader title="Largest" id="lnx-top-cap">
          <Link class="tap" href={paths.lightningRankings("capacity")}>
            Top 100
          </Link>
        </SectionHeader>
        <DataTable
          caption="The five nodes with the most capacity"
          columns={ranked("capacity")}
          rows={o.top_capacity.slice(0, 5)}
          rowHref={(n) => paths.lightningNode(n.id)}
        />
      </section>
      <section data-list="ch" aria-labelledby="lnx-top-ch">
        <SectionHeader title="Most connected" id="lnx-top-ch">
          <Link class="tap" href={paths.lightningRankings("channels")}>
            Top 100
          </Link>
        </SectionHeader>
        <DataTable
          caption="The five nodes with the most channels"
          columns={ranked("channels")}
          rows={o.top_channels.slice(0, 5)}
          rowHref={(n) => paths.lightningNode(n.id)}
        />
      </section>
      <section data-list="new" aria-labelledby="lnx-new">
        <SectionHeader title="Newest nodes" id="lnx-new">
          {props.period.label}
        </SectionHeader>
        <DataTable
          caption="Newest nodes"
          columns={arrivals(false)}
          rows={m().new.slice(0, 5)}
          rowHref={(r) => paths.lightningNode(r.id)}
          empty={<Empty title="None in this period" />}
        />
      </section>
      <section data-list="left" aria-labelledby="lnx-left">
        <SectionHeader title="Nodes that left" id="lnx-left">
          {props.period.label}
        </SectionHeader>
        <DataTable
          caption="Nodes that left"
          columns={arrivals(true)}
          rows={m().left.slice(0, 5)}
          empty={<Empty title="None in this period" />}
        />
      </section>
    </div>
  );
}
