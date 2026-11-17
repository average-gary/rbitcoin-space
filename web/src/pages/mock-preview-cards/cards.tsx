// MOCKUP, never merged: three directions for the link preview cards, each 1200 by 630, each drawn
// for a confirmed transaction, an unconfirmed one, a block and an address.
import type { JSX } from "@solidjs/web";
import { groupDigits } from "../../lib/format";
import {
  address,
  BAND_FLOOR,
  block,
  CARD_H,
  CARD_W,
  clock,
  confirmedTx,
  DARK,
  day,
  LIGHT,
  month,
  type Palette,
  projected,
  recordedAt,
  strip,
  type TxCard,
  unconfirmedTx,
  waitsIn,
} from "./model";
import {
  Check,
  Chip,
  Clock,
  Core,
  CoreKey,
  Flow,
  highest,
  layerMiddle,
  Logo,
  lowest,
  Marker,
  mw,
  Network,
  Steps,
  T,
  Value,
} from "./parts";

export type Subject = "tx" | "tx-unconfirmed" | "block" | "address";
export const SUBJECTS: Subject[] = ["tx", "tx-unconfirmed", "block", "address"];

/** What a chat app prints under the picture: the page's title and the link. */
export function linkOf(s: Subject): { title: string; path: string } {
  const links: Record<Subject, { title: string; path: string }> = {
    tx: { title: `Transaction ${confirmedTx.id}`, path: confirmedTx.path },
    "tx-unconfirmed": { title: `Transaction ${unconfirmedTx.id}`, path: unconfirmedTx.path },
    block: { title: `Block ${block.heightText}`, path: `block/${block.hash}` },
    address: { title: `Address ${address.id}`, path: address.path },
  };
  return links[s];
}

const txOf = (s: Subject): TxCard => (s === "tx" ? confirmedTx : unconfirmedTx);

function Frame(props: { pal: Palette; width?: number | undefined; children: JSX.Element }) {
  return (
    <svg
      class="pc-card"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      width={props.width ?? CARD_W}
      height={((props.width ?? CARD_W) * CARD_H) / CARD_W}
      role="img"
    >
      <rect width={CARD_W} height={CARD_H} fill={props.pal.bg} />
      {props.children}
    </svg>
  );
}

/* ---------------------------------------------------------------------------------------------
 * A: the page in miniature. Light. The site's own summary panel: figures in a grid on the left,
 * the page's drawing on the right, the title and status above, as the page opens.
 * ------------------------------------------------------------------------------------------- */

const A = LIGHT;
const COLS_A = [80, 336, 530];

function FigureA(props: { x: number; label: string; value: string; unit?: string; sub?: string }) {
  return (
    <g>
      <T x={props.x} y={438} size={30} fill={A.muted}>
        {props.label}
      </T>
      <Value
        x={props.x}
        y={494}
        size={44}
        unitSize={28}
        pal={A}
        value={props.value}
        unit={props.unit}
      />
      {props.sub ? (
        <T x={props.x} y={540} size={30} fill={A.muted}>
          {props.sub}
        </T>
      ) : null}
    </g>
  );
}

function HeadA() {
  return (
    <g>
      <Logo x={52} y={30} size={60} ink={A.text} top={A.accent} />
      <T x={124} y={74} size={32} fill={A.text} bold>
        rbitcoin.space
      </T>
      <Network x={1144} y={72} size={30} pal={A} />
    </g>
  );
}

export function CardA(props: { s: Subject; width?: number }) {
  const s = props.s;
  const title =
    s === "block" ? `Block ${block.heightText}` : s === "address" ? "Address" : "Transaction";
  const id = s === "block" ? block.id : s === "address" ? address.id : txOf(s).id;
  const afterTitle = 56 + mw(title, 44) + 26;
  return (
    <Frame pal={A} width={props.width}>
      <HeadA />
      <T x={56} y={170} size={44} fill={A.text} bold>
        {title}
      </T>
      {s === "tx" || s === "tx-unconfirmed" ? (
        <Chip x={afterTitle} cy={155} size={28} confirmed={s === "tx"} pal={A} />
      ) : (
        <T x={afterTitle} y={168} size={30} fill={A.muted}>
          {s === "block"
            ? `${day(block.time)}, ${clock(block.time)}`
            : `as of block ${address.tip}`}
        </T>
      )}
      <T x={56} y={224} size={36} fill={A.text}>
        {id}
      </T>
      <rect
        x={40}
        y={254}
        width={1120}
        height={338}
        rx={10}
        fill={A.surface}
        stroke={A.line}
        stroke-width={2}
      />
      {s === "tx" || s === "tx-unconfirmed" ? <TxBodyA t={txOf(s)} /> : null}
      {s === "block" ? <BlockBodyA /> : null}
      {s === "address" ? <AddressBodyA /> : null}
    </Frame>
  );
}

function Row1A(props: { label: string; value: string; zeros?: string; unit?: string }) {
  return (
    <g>
      <T x={80} y={308} size={30} fill={A.muted}>
        {props.label}
      </T>
      <Value
        x={80}
        y={374}
        size={60}
        unitSize={32}
        pal={A}
        value={props.value}
        zeros={props.zeros}
        unit={props.unit}
      />
    </g>
  );
}

function TxBodyA(props: { t: TxCard }) {
  const t = props.t;
  return (
    <g>
      <Row1A label="Amount" value={t.amount.value} zeros={t.amount.zeros} unit="BTC" />
      <FigureA
        x={COLS_A[0] ?? 0}
        label="Fee rate"
        value={t.rateText}
        unit="sat/vB"
        sub={`${t.fee} sats`}
      />
      <FigureA x={COLS_A[1] ?? 0} label="Size" value={t.size} unit="vB" />
      {t.confirmed ? (
        <FigureA
          x={COLS_A[2] ?? 0}
          label="Block"
          value={groupDigits(t.height ?? 0)}
          sub={day(t.time)}
        />
      ) : (
        <FigureA
          x={COLS_A[2] ?? 0}
          label="Projected"
          value="Next"
          unit="block"
          sub={`at ${clock(t.time)}`}
        />
      )}
      <Flow
        x={770}
        y={300}
        w={350}
        h={210}
        inputs={t.inputs}
        outputs={t.outputs}
        fee={t.feeSats}
        band={t.band}
        pal={A}
        stem={150}
      />
      <T x={770} y={556} size={28} fill={A.muted}>
        {`${t.inputs.length} in`}
      </T>
      <T x={1120} y={556} size={28} fill={A.muted} end>
        {`${t.outputs.length} out`}
      </T>
    </g>
  );
}

function BlockBodyA() {
  return (
    <g>
      <Row1A label="Miner" value={block.miner} />
      <FigureA x={COLS_A[0] ?? 0} label="Transactions" value={block.txCount} sub={block.size} />
      <FigureA x={330} label="Median fee" value={block.median} unit="sat/vB" />
      <FigureA x={604} label="Fees" value={block.fees} unit="BTC" />
      <Core
        x={870}
        y={286}
        w={170}
        h={274}
        bands={block.bands}
        fill={block.fill}
        pal={A}
        frame={A.lineStrong}
      />
      <T x={1046} y={276} size={28} fill={A.muted}>
        sat/vB
      </T>
      <CoreKey
        x={1062}
        y={286}
        h={274}
        bands={block.bands}
        fill={block.fill}
        size={28}
        pal={A}
        floors={BAND_FLOOR}
      />
    </g>
  );
}

function AddressBodyA() {
  const x = 780;
  const w = 340;
  const low = lowest(address.steps, x, w, recordedAt);
  return (
    <g>
      <Row1A label="Balance" value={address.balance} unit="BTC" />
      <FigureA x={COLS_A[0] ?? 0} label="Transactions" value={address.txCount} />
      <FigureA x={COLS_A[1] ?? 0} label="Received" value={address.received} unit="BTC" />
      <T x={x} y={306} size={28} fill={A.muted}>
        {groupDigits(highest(address.steps) / 1e8)}
      </T>
      <Steps
        x={x}
        y={322}
        w={w}
        h={160}
        steps={address.steps}
        until={recordedAt}
        color={A.series}
        width={4}
      />
      <T x={low.x} y={518} size={28} fill={A.muted}>
        {groupDigits(low.value / 1e8)}
      </T>
      <T x={x} y={562} size={28} fill={A.muted}>
        {month(address.steps[0]?.[0] ?? 0)}
      </T>
      <T x={x + w} y={562} size={28} fill={A.muted} end>
        {month(recordedAt)}
      </T>
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------
 * B: the core sample. Dark. A full-height column on the left is the drawing: the block the
 * transaction sits in, with it marked; the figures stand large beside it.
 * ------------------------------------------------------------------------------------------- */

const B = DARK;
const COL_B = 380;
const XB = 430;
const BOX_B = { x: 40, y: 150, w: 196, h: 440 };

function ColumnB(props: { head: string; sub: string; children: JSX.Element }) {
  return (
    <g>
      <rect x={0} y={0} width={COL_B} height={CARD_H} fill={B.surface} />
      <T x={40} y={76} size={34} fill={B.text} bold>
        {props.head}
      </T>
      <T x={40} y={118} size={28} fill={B.muted}>
        {props.sub}
      </T>
      {props.children}
    </g>
  );
}

function FootB() {
  return (
    <g>
      <Logo x={XB - 4} y={540} size={54} ink={B.text} top={B.accent} />
      <T x={XB + 62} y={580} size={30} fill={B.text} bold>
        rbitcoin.space
      </T>
      <Network x={1150} y={580} size={28} pal={B} />
    </g>
  );
}

/** Figures in a row, each as wide as its value or label, 44 px apart. */
function FiguresB(props: { items: { label: string; value: string; unit?: string }[] }) {
  let x = XB;
  return (
    <g>
      {props.items.map((f) => {
        const at = x;
        const w = mw(f.value, 42) + (f.unit ? mw(` ${f.unit}`, 26) : 0);
        x += Math.max(w, mw(f.label, 28)) + 44;
        return (
          <g>
            <T x={at} y={384} size={28} fill={B.muted}>
              {f.label}
            </T>
            <Value x={at} y={438} size={42} unitSize={26} pal={B} value={f.value} unit={f.unit} />
          </g>
        );
      })}
    </g>
  );
}

function TitleB(props: { title: string; id: string; status?: boolean }) {
  return (
    <g>
      <T x={XB} y={92} size={40} fill={B.text} bold>
        {props.title}
      </T>
      {props.status === undefined ? null : (
        <Chip
          x={XB + mw(props.title, 40) + 24}
          cy={78}
          size={28}
          confirmed={props.status}
          pal={B}
        />
      )}
      <T x={XB} y={146} size={34} fill={B.muted}>
        {props.id}
      </T>
    </g>
  );
}

/** The balance as one area: width is the balance, time runs up the column, oldest at the floor. */
function balanceArea(
  steps: readonly [number, number][],
  hi: number,
  yAt: (t: number) => number,
): string {
  const x0 = BOX_B.x;
  let d = `M${x0} ${Math.round(yAt(steps[0]?.[0] ?? 0))}`;
  for (const [i, [t, v]] of steps.entries()) {
    const w = Math.round((v / hi) * BOX_B.w);
    const next = steps[i + 1]?.[0] ?? recordedAt;
    d += `V${Math.round(yAt(t))}H${x0 + w}V${Math.round(yAt(next))}`;
  }
  return `${d}H${x0}Z`;
}

export function CardB(props: { s: Subject; width?: number }) {
  const s = props.s;
  if (s === "block") {
    return (
      <Frame pal={B} width={props.width}>
        <ColumnB
          head={block.miner}
          sub={`${day(block.time)}, ${clock(block.time).replace(" UTC", "")}`}
        >
          <Core {...BOX_B} bands={block.bands} fill={block.fill} pal={B} frame={B.lineStrong} />
          <CoreKey
            x={252}
            y={BOX_B.y}
            h={BOX_B.h}
            bands={block.bands}
            fill={block.fill}
            size={28}
            pal={B}
            floors={BAND_FLOOR}
          />
        </ColumnB>
        <TitleB title="Block" id={block.id} />
        <Value x={XB} y={292} size={96} unitSize={40} pal={B} value={block.heightText} />
        <FiguresB
          items={[
            { label: "Transactions", value: block.txCount },
            { label: "Median fee", value: block.median, unit: "sat/vB" },
            { label: "Fees", value: block.fees, unit: "BTC" },
          ]}
        />
        <FootB />
      </Frame>
    );
  }
  if (s === "address") {
    const steps = address.steps;
    const t0 = steps[0]?.[0] ?? 0;
    const hi = highest(steps);
    const yAt = (t: number) => BOX_B.y + BOX_B.h - ((t - t0) / (recordedAt - t0)) * BOX_B.h;
    return (
      <Frame pal={B} width={props.width}>
        <ColumnB head="Balance" sub={`as of block ${address.tip}`}>
          <path d={balanceArea(steps, hi, yAt)} fill={B.series} />
          <line
            x1={BOX_B.x}
            x2={BOX_B.x}
            y1={BOX_B.y}
            y2={BOX_B.y + BOX_B.h}
            stroke={B.lineStrong}
            stroke-width={2}
          />
          <T x={252} y={BOX_B.y + 24} size={28} fill={B.muted}>
            {month(recordedAt)}
          </T>
          <T x={252} y={BOX_B.y + BOX_B.h} size={28} fill={B.muted}>
            {month(t0)}
          </T>
        </ColumnB>
        <TitleB title="Address" id={address.id} />
        <Value x={XB} y={292} size={96} unitSize={40} pal={B} value={address.balance} unit="BTC" />
        <FiguresB
          items={[
            { label: "Transactions", value: address.txCount },
            { label: "Received", value: address.received, unit: "BTC" },
          ]}
        />
        <FootB />
      </Frame>
    );
  }
  const t = txOf(s);
  const where = t.confirmed ? null : projected[waitsIn];
  const bands = where ? where.bands : block.bands;
  const fill = where ? where.fill : block.fill;
  const markY = BOX_B.y + layerMiddle(bands, fill, BOX_B.h, t.band);
  return (
    <Frame pal={B} width={props.width}>
      <ColumnB
        head={
          t.confirmed
            ? `Block ${groupDigits(t.height ?? 0)}`
            : waitsIn === 0
              ? "Next block"
              : `Block +${waitsIn + 1}`
        }
        sub={
          t.confirmed
            ? `${day(t.time)}, ${clock(t.time).replace(" UTC", "")}`
            : `projected ${clock(t.time)}`
        }
      >
        <Core
          {...BOX_B}
          bands={bands}
          fill={fill}
          pal={B}
          dashed={!t.confirmed}
          frame={t.confirmed ? B.lineStrong : undefined}
        />
        <CoreKey
          x={252}
          y={BOX_B.y}
          h={BOX_B.h}
          bands={bands}
          fill={fill}
          size={28}
          pal={B}
          floors={BAND_FLOOR}
        />
        <Marker
          cx={BOX_B.x + 52}
          cy={Math.max(BOX_B.y + 30, markY)}
          s={30}
          band={t.band}
          ring={B.accent}
          gap={B.surface}
        />
      </ColumnB>
      <TitleB title="Transaction" id={t.id} status={t.confirmed} />
      <Value
        x={XB}
        y={292}
        size={88}
        unitSize={40}
        pal={B}
        value={t.amount.value}
        zeros={t.amount.zeros}
        unit="BTC"
      />
      <FiguresB
        items={[
          { label: "Fee rate", value: t.rateText, unit: "sat/vB" },
          { label: "Fee", value: t.fee, unit: "sats" },
          { label: "Size", value: t.size, unit: "vB" },
        ]}
      />
      <FootB />
    </Frame>
  );
}

/* ---------------------------------------------------------------------------------------------
 * C: one answer, large, over the block strip. Light, on white. The figure the link is about is
 * set as big as the card allows; below it the strip from the home page shows where it sits.
 * ------------------------------------------------------------------------------------------- */

const C: Palette = { ...LIGHT, bg: "#ffffff" };
const BAND_C = 444;
const TILE = { w: 128, h: 120, y: 468, gap: 16 };

interface FigC {
  label: string;
  value: string;
  unit?: string;
  status?: "confirmed" | "unconfirmed";
}

function FiguresC(props: { items: FigC[] }) {
  let x = 56;
  return (
    <g>
      {props.items.map((f) => {
        const at = x;
        const w = mw(f.value, 40) + (f.unit ? mw(` ${f.unit}`, 28) : 0);
        const lw = mw(f.label, 28) + (f.status ? 40 : 0);
        x += Math.max(w, lw) + 56;
        const color =
          f.status === "confirmed" ? C.positive : f.status === "unconfirmed" ? C.caution : C.muted;
        return (
          <g>
            <Value x={at} y={362} size={40} unitSize={28} pal={C} value={f.value} unit={f.unit} />
            {f.status === "confirmed" ? <Check x={at} y={380} s={26} color={color} /> : null}
            {f.status === "unconfirmed" ? <Clock x={at} y={380} s={28} color={color} /> : null}
            <T
              x={at + (f.status ? 38 : 0)}
              y={404}
              size={28}
              fill={color}
              bold={f.status !== undefined}
            >
              {f.label}
            </T>
          </g>
        );
      })}
    </g>
  );
}

function HeadC(props: { kind: string; id: string }) {
  return (
    <g>
      <Logo x={52} y={26} size={56} ink={C.text} top={C.accent} />
      <T x={122} y={68} size={32} fill={C.text} bold>
        rbitcoin.space
      </T>
      <Network x={1144} y={66} size={28} pal={C} />
      <T x={56} y={156} size={34} fill={C.muted}>
        {props.kind}
      </T>
      <T x={56 + mw(`${props.kind} `, 34) + 6} y={156} size={34} fill={C.text}>
        {props.id}
      </T>
    </g>
  );
}

/** The strip: three projected blocks, the "now" line, then mined blocks running into the past. */
function StripC(props: { mark?: { tile: number; band: number }; focus: number }) {
  const NOW = 56 + 3 * (TILE.w + TILE.gap) - TILE.gap / 2;
  const tileX = (i: number) =>
    i < 3 ? 56 + i * (TILE.w + TILE.gap) : NOW + TILE.gap / 2 + 8 + (i - 3) * (TILE.w + TILE.gap);
  const labels = ["~10 min", "~20 min", "~30 min"];
  const tiles = [
    ...projected
      .slice(0, 3)
      .map((p, i) => ({ bands: p.bands, fill: p.fill, label: labels[i] ?? "", mined: false })),
    ...strip
      .slice(0, 5)
      .map((b) => ({ bands: b.bands, fill: b.fill, label: b.heightText, mined: true })),
  ];
  return (
    <g>
      <rect x={0} y={BAND_C} width={CARD_W} height={CARD_H - BAND_C} fill={C.sunken} />
      <line x1={0} x2={CARD_W} y1={BAND_C} y2={BAND_C} stroke={C.line} stroke-width={2} />
      {tiles.map((t, i) => {
        const x = tileX(i);
        const focus = i === props.focus;
        return (
          <g>
            {t.mined ? (
              <rect x={x} y={TILE.y} width={TILE.w} height={TILE.h} rx={6} fill={C.surface} />
            ) : null}
            <Core
              x={x}
              y={TILE.y}
              w={TILE.w}
              h={TILE.h}
              bands={t.bands}
              fill={t.fill}
              pal={C}
              dashed={!t.mined}
              frame={focus ? C.accent : t.mined ? C.line : C.lineStrong}
              frameWidth={focus ? 4 : 2}
              inset={6}
            />
            <T x={x} y={620} size={28} fill={focus ? C.text : C.muted} bold={focus}>
              {t.label}
            </T>
          </g>
        );
      })}
      <line
        x1={NOW + 4}
        x2={NOW + 4}
        y1={TILE.y - 12}
        y2={TILE.y + TILE.h + 12}
        stroke={C.text}
        stroke-width={3}
      />
      {props.mark ? (
        <Marker
          cx={tileX(props.mark.tile) + 30}
          cy={Math.max(
            TILE.y + 22,
            TILE.y +
              layerMiddle(
                tiles[props.mark.tile]?.bands ?? [],
                tiles[props.mark.tile]?.fill ?? 0,
                TILE.h,
                props.mark.band,
                6,
              ),
          )}
          s={22}
          band={props.mark.band}
          ring={C.accent}
          gap={C.surface}
        />
      ) : null}
    </g>
  );
}

export function CardC(props: { s: Subject; width?: number }) {
  const s = props.s;
  if (s === "block") {
    const date = `${day(block.time)}, ${clock(block.time)}`;
    return (
      <Frame pal={C} width={props.width}>
        <HeadC kind="Block" id={block.id} />
        <Value x={52} y={282} size={120} unitSize={48} pal={C} value={block.heightText} />
        <T x={56 + mw(block.heightText, 120) + 40} y={280} size={34} fill={C.muted}>
          {date}
        </T>
        <FiguresC
          items={[
            { label: "Miner", value: block.miner },
            { label: "Transactions", value: block.txCount },
            { label: "Median fee", value: block.median, unit: "sat/vB" },
            { label: "Fees", value: block.fees, unit: "BTC" },
          ]}
        />
        <StripC focus={3} />
      </Frame>
    );
  }
  if (s === "address") {
    const x = 56;
    const w = 1088;
    const low = lowest(address.steps, x, w, recordedAt);
    return (
      <Frame pal={C} width={props.width}>
        <HeadC kind="Address" id={address.id} />
        <Value x={52} y={282} size={120} unitSize={48} pal={C} value={address.balance} unit="BTC" />
        <FiguresC
          items={[
            { label: "Transactions", value: address.txCount },
            { label: "Received", value: address.received, unit: "BTC" },
            { label: "Last active", value: day(address.lastActive) },
            { label: "As of block", value: address.tip },
          ]}
        />
        <rect x={0} y={BAND_C} width={CARD_W} height={CARD_H - BAND_C} fill={C.sunken} />
        <line x1={0} x2={CARD_W} y1={BAND_C} y2={BAND_C} stroke={C.line} stroke-width={2} />
        <T x={x} y={484} size={28} fill={C.muted}>
          {`${groupDigits(highest(address.steps) / 1e8)} BTC`}
        </T>
        <Steps
          x={x}
          y={500}
          w={w}
          h={64}
          steps={address.steps}
          until={recordedAt}
          color={C.series}
          width={4}
        />
        <T x={low.x + 12} y={602} size={28} fill={C.muted}>
          {groupDigits(low.value / 1e8)}
        </T>
        <T x={x} y={612} size={28} fill={C.muted}>
          {month(address.steps[0]?.[0] ?? 0)}
        </T>
        <T x={x + w} y={612} size={28} fill={C.muted} end>
          {month(recordedAt)}
        </T>
      </Frame>
    );
  }
  const t = txOf(s);
  return (
    <Frame pal={C} width={props.width}>
      <HeadC kind="Transaction" id={t.id} />
      <Value
        x={52}
        y={282}
        size={120}
        unitSize={48}
        pal={C}
        value={t.amount.value}
        zeros={t.amount.zeros}
        unit="BTC"
      />
      <FiguresC
        items={[
          { label: "Fee rate", value: t.rateText, unit: "sat/vB" },
          { label: "Fee", value: t.fee, unit: "sats" },
          { label: "Size", value: t.size, unit: "vB" },
          t.confirmed
            ? { label: "Confirmed", value: day(t.time), status: "confirmed" }
            : { label: "Unconfirmed", value: clock(t.time), status: "unconfirmed" },
        ]}
      />
      <StripC
        focus={t.confirmed ? 3 : waitsIn}
        mark={{ tile: t.confirmed ? 3 : waitsIn, band: t.band }}
      />
    </Frame>
  );
}

export const DIRECTIONS = [
  {
    key: "a",
    name: "A. The page in miniature",
    theme: "Light",
    Card: CardA,
    idea: "The page's own summary panel, shrunk to a card: title and status, the figures in a grid, the page's drawing beside them.",
    why: "Light, the site's default, so the card looks like the page it opens; it also stands out on the dark chat backgrounds most phones use.",
    hard: "The flow's ribbons: filled cubic curves with smooth edges need a real path rasteriser, not just rectangles.",
  },
  {
    key: "b",
    name: "B. The core sample",
    theme: "Dark",
    Card: CardB,
    idea: "A full-height column is the drawing: the block the transaction settled in (or the projected block it waits for), with it marked; the figures stand large beside it.",
    why: "Dark, because the drawing leads: the fee layers and the accent ring are brightest on charcoal, and it reads as a deliberate tile on a light chat too.",
    hard: "The projected block's dashed outline, dashes laid along a rounded rectangle; and the live projection it needs.",
  },
  {
    key: "c",
    name: "C. One answer over the strip",
    theme: "Light (white)",
    Card: CardC,
    idea: "The one figure the link is about, as big as the card allows, over the home page's block strip with the subject's block ringed in the accent.",
    why: "Light on white, so the giant figure has the most contrast and the strip's sunken band reads as it does on the home page.",
    hard: "Not the shapes but the data: the strip needs five neighbouring blocks' fee bands and the live projection for every card.",
  },
] as const;
