// MOCKUP, never merged: the flow diagram with its cards as two-line ledger rows. The ribbon
// geometry is the real page's (pages/tx/Flow.tsx); only the cards and their layout differ.
import { createEffect, createSignal, For, onSettled, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Amount } from "../../components/Amount";
import { FeeRate } from "../../components/FeeRate";
import { Hash } from "../../components/Hash";
import { Link } from "../../components/Link";
import type { Outspend, Transaction, Vout } from "../../lib/esplora";
import { feeColor, groupDigits } from "../../lib/format";
import { paths } from "../../lib/network";
import { scriptLabel, type Selection, type Side } from "../tx/Flow";
import { classify } from "../tx/script";
import {
  cssMs,
  isCoinbase,
  MORE_STEP,
  shownCount,
  totalIn,
  totalOut,
  vsize,
  whyUnspendable,
} from "../tx/tx";

interface Ribbon {
  d: string;
  kind: "in" | "out" | "fee" | "more";
  key: string;
}

const tokenMs = (name: string) =>
  cssMs(getComputedStyle(document.documentElement).getPropertyValue(name));

export function MockFlow(props: {
  tx: Transaction;
  outspends: Outspend[];
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const [inPresses, setInPresses] = createSignal(0);
  const [outPresses, setOutPresses] = createSignal(0);
  const vin = () => props.tx.vin ?? [];
  const inShown = () => shownCount(vin().length, inPresses());
  const outShown = () => shownCount(props.tx.vout.length, outPresses());
  const coinbase = () => isCoinbase(props.tx);
  const fee = () => (coinbase() ? 0 : (props.tx.fee ?? 0));
  const rate = () => {
    const v = vsize(props.tx);
    return v !== undefined && v !== 0 ? fee() / v : 0;
  };
  const hiddenIn = () =>
    vin()
      .slice(inShown())
      .reduce((a, i) => a + (i.prevout?.value ?? 0), 0);
  const hiddenOut = () => props.tx.vout.slice(outShown()).reduce((a, o) => a + o.value, 0);

  let flowEl: HTMLDivElement | undefined;
  let svgEl: SVGSVGElement | undefined;
  let inCol: HTMLUListElement | undefined;
  let outCol: HTMLUListElement | undefined;
  const [ribbons, setRibbons] = createSignal<Ribbon[]>([]);
  const [trunk, setTrunk] = createSignal({ x: 0, y: 0, h: 0 });
  const [view, setView] = createSignal("0 0 0 0");

  const fitAmounts = () => {
    const fits = flowEl?.querySelectorAll<HTMLElement>(".mtx-card .amount[data-short]");
    for (const amount of fits ?? []) {
      const exact = amount.querySelector(".amount__exact");
      const cell = amount.closest(".mtx-card__amt");
      if (!exact || !cell) continue;
      amount.classList.remove("amount--tight");
      const e = exact.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      amount.classList.toggle("amount--tight", e.left < c.left - 1 || e.right > c.right + 1);
    }
  };

  const draw = () => {
    fitAmounts();
    if (!svgEl || !inCol || !outCol) return;
    const box = svgEl.getBoundingClientRect();
    const W = box.width;
    const H = box.height;
    if (W === 0 || H === 0) return;
    const total = Math.max(totalIn(props.tx), totalOut(props.tx) + fee(), 1);
    const cards = [...inCol.children, ...outCol.children].map(
      (el) => el.getBoundingClientRect().height,
    );
    const T = Math.min(H * 0.8, 96, Math.min(...cards) * 0.8);
    const mid = W / 2;
    const thicknesses = (col: HTMLUListElement) =>
      ([...col.children] as HTMLElement[]).map((el) =>
        Math.max(1.5, (Number(el.dataset["value"]) / total) * T),
      );
    const tIn = thicknesses(inCol);
    const tOut = thicknesses(outCol);
    const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const side = (col: HTMLUListElement, thick: number[], toRight: boolean): Ribbon[] => {
      const items = [...col.children] as HTMLElement[];
      let y = H / 2 - sumOf(thick) / 2;
      const c = (toRight ? 1 : -1) * W * 0.45;
      return items.map((el, k) => {
        const r = el.getBoundingClientRect();
        const cy = r.top + r.height / 2 - box.top;
        const th = thick[k] ?? 1.5;
        const a = { x: toRight ? 0 : W, y0: cy - th / 2, y1: cy + th / 2 };
        const b = { x: mid, y0: y, y1: y + th };
        y += th;
        const f = (n: number) => n.toFixed(1);
        return {
          d: `M${f(a.x)},${f(a.y0)} C${f(a.x + c)},${f(a.y0)} ${f(b.x - c)},${f(b.y0)} ${f(b.x)},${f(b.y0)} L${f(b.x)},${f(b.y1)} C${f(b.x - c)},${f(b.y1)} ${f(a.x + c)},${f(a.y1)} ${f(a.x)},${f(a.y1)} Z`,
          kind: (el.dataset["kind"] as Ribbon["kind"]) ?? (toRight ? "in" : "out"),
          key: `${toRight ? "i" : "o"}${el.dataset["key"] ?? k}`,
        };
      });
    };
    const left = side(inCol, tIn, true);
    const right = side(outCol, tOut, false);
    const span = Math.max(sumOf(tIn), sumOf(tOut));
    setView(`0 0 ${W} ${H}`);
    setTrunk({ x: mid, y: H / 2 - span / 2, h: span });
    setRibbons([...left, ...right]);
  };

  let first = true;
  const animate = () => {
    if (!first || !svgEl || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    first = false;
    const d = tokenMs("--dur-slow");
    const s = tokenMs("--stagger");
    const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim();
    if (!d) return;
    [...svgEl.querySelectorAll<SVGPathElement>(".tx-ribbon")].forEach((p, k) => {
      const out = p.dataset["side"] === "out";
      p.animate(
        [
          { opacity: 0, transform: "translateX(-8px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: d,
          delay: (out ? d * 0.5 : 0) + Math.min(k, 12) * s,
          easing: ease || "ease-out",
          fill: "backwards",
        },
      );
    });
  };

  onSettled(() => {
    const ro = new ResizeObserver(() => draw());
    if (flowEl) ro.observe(flowEl);
    requestAnimationFrame(() => {
      draw();
      requestAnimationFrame(animate);
    });
    return () => ro.disconnect();
  });
  createEffect(
    () => [inShown(), outShown(), props.selected],
    () => {
      requestAnimationFrame(draw);
    },
    { defer: true },
  );

  const isSel = (side: Side, index: number) =>
    props.selected?.side === side && props.selected.index === index;

  const openButton = (side: Side, index: number) => (
    <button
      type="button"
      class="mtx-card__open"
      aria-expanded={isSel(side, index) ? "true" : "false"}
      aria-controls="tx-inspector"
      aria-label={`Details of ${side === "in" ? "input" : "output"} ${index}`}
      onClick={() => props.onSelect({ side, index })}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 4l4 4-4 4" />
      </svg>
    </button>
  );

  /** The address, cut in the middle only as far as the card needs; or what the script is. */
  const who = (out: Vout | null | undefined): JSX.Element => (
    <Show
      when={out?.scriptpubkey_address}
      fallback={<span class="mtx-card__label">{out ? scriptLabel(out) : "Unknown"}</span>}
    >
      {(a) => <Hash value={a()} href={paths.address(a())} fit copy={false} />}
    </Show>
  );

  const more = (side: Side, hidden: number, value: number, press: () => void): JSX.Element => (
    <li class="mtx-card mtx-card--more" data-value={value} data-kind="more" data-key="more">
      <button type="button" class="mtx-card__more" onClick={press}>
        Show {groupDigits(Math.min(hidden, MORE_STEP))} more
      </button>
      <span class="mtx-card__amt">
        <Amount sats={value} unit={false} fit />
      </span>
      <span class="mtx-card__meta">
        {groupDigits(hidden)} more {side === "in" ? "inputs" : "outputs"}
      </span>
    </li>
  );

  return (
    <div class="mtx-flow" ref={flowEl}>
      <ul class="mtx-flow__col mtx-flow__col--in" aria-label="Inputs" ref={inCol}>
        <Show
          when={!coinbase()}
          fallback={
            <li
              class={["mtx-card", { "is-selected": isSel("in", 0) }]}
              data-value={totalOut(props.tx)}
              data-kind="in"
              data-key="0"
            >
              <span class="mtx-card__who">Coinbase</span>
              <span class="mtx-card__amt">
                <Amount sats={totalOut(props.tx)} unit={false} fit />
              </span>
              <span class="mtx-card__meta">New coins and fees</span>
              {openButton("in", 0)}
            </li>
          }
        >
          <For each={vin().slice(0, inShown())}>
            {(input, i) => (
              <li
                class={["mtx-card", { "is-selected": isSel("in", i()) }]}
                data-value={input.prevout?.value ?? 0}
                data-key={i()}
              >
                <span class="mtx-card__who">{who(input.prevout)}</span>
                <span class="mtx-card__amt">
                  <Show when={input.prevout} fallback={<span class="amount">–</span>}>
                    {(p) => <Amount sats={p().value} unit={false} fit />}
                  </Show>
                </span>
                <span class="mtx-card__meta">
                  {input.prevout?.scriptpubkey_address
                    ? classify(input.prevout.scriptpubkey).label
                    : ""}
                </span>
                {openButton("in", i())}
              </li>
            )}
          </For>
          <Show when={vin().length > inShown()}>
            {more("in", vin().length - inShown(), hiddenIn(), () => setInPresses((n) => n + 1))}
          </Show>
        </Show>
      </ul>
      <svg class="tx-flow__ribbons" ref={svgEl} viewBox={view()} aria-hidden="true">
        <For keyed={false} each={ribbons()}>
          {(r) => (
            <path
              class={`tx-ribbon tx-ribbon--${r().kind}${
                props.selected !== null &&
                r().key === `${props.selected.side === "in" ? "i" : "o"}${props.selected.index}`
                  ? " is-selected"
                  : ""
              }`}
              data-side={r().key.startsWith("i") ? "in" : "out"}
              d={r().d}
              style={r().kind === "fee" ? { "--swatch": feeColor(rate()) } : undefined}
            />
          )}
        </For>
        <rect
          class="tx-flow__trunk"
          x={trunk().x - 3}
          y={trunk().y - 3}
          width={6}
          height={trunk().h + 6}
          rx={3}
        />
      </svg>
      <ul class="mtx-flow__col mtx-flow__col--out" aria-label="Outputs" ref={outCol}>
        <For each={props.tx.vout.slice(0, outShown())}>
          {(out, i) => (
            <li
              class={["mtx-card", { "is-selected": isSel("out", i()) }]}
              data-value={out.value}
              data-key={i()}
            >
              <span class="mtx-card__who">{who(out)}</span>
              <span class="mtx-card__amt">
                <Amount sats={out.value} unit={false} fit />
              </span>
              <span class="mtx-card__meta">
                <Show when={out.scriptpubkey_address}>
                  <span>{classify(out.scriptpubkey).label}</span>
                </Show>
                <Spent
                  unspendable={whyUnspendable(props.tx, out) !== null}
                  spend={props.outspends[i()]}
                />
              </span>
              {openButton("out", i())}
            </li>
          )}
        </For>
        <Show when={props.tx.vout.length > outShown()}>
          {more("out", props.tx.vout.length - outShown(), hiddenOut(), () =>
            setOutPresses((n) => n + 1),
          )}
        </Show>
        <Show when={fee() > 0}>
          <li
            class="mtx-card mtx-card--fee"
            style={{ "--swatch": feeColor(rate()) }}
            data-value={fee()}
            data-kind="fee"
            data-key="fee"
          >
            <span class="mtx-card__who">Fee</span>
            <span class="mtx-card__amt">
              <Amount sats={fee()} unit={false} fit />
            </span>
            <span class="mtx-card__meta">
              <FeeRate rate={rate()} />
            </span>
          </li>
        </Show>
      </ul>
    </div>
  );
}

function Spent(props: { unspendable: boolean; spend: Outspend | undefined }) {
  return (
    <Show when={!props.unspendable} fallback={<span>Unspendable</span>}>
      <Show when={props.spend}>
        {(s) => (
          <Show when={s().spent && s().txid} fallback={<span>Unspent</span>}>
            {(by) => (
              <Link href={paths.tx(by())} class="mtx-card__spent">
                {s().status?.confirmed === false ? "Being spent" : "Spent"}
                <span class="visually-hidden"> in transaction {by()}</span>
              </Link>
            )}
          </Show>
        )}
      </Show>
    </Show>
  );
}
