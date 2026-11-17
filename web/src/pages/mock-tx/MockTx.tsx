// MOCKUP, never merged: a redesigned transaction page for the owner to look at, drawn from
// answers recorded once from the public site (samples/), so it needs no server.
import { useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Amount, Sats } from "../../components/Amount";
import { FeeRate } from "../../components/FeeRate";
import { HashFull } from "../../components/Hash";
import { Link } from "../../components/Link";
import { More } from "../../components/More";
import { SectionHeader } from "../../components/SectionHeader";
import { TimeAgo, TimeUtc } from "../../components/Time";
import type { Outspend, Transaction } from "../../lib/esplora";
import { feeColor, formatSize, groupDigits, MISSING } from "../../lib/format";
import { paths } from "../../lib/network";
import { useNetwork, usePageTitle } from "../../lib/page";
import type { Position } from "../../lib/track-topics";
import { Code } from "../tx/Code";
import type { Selection } from "../tx/Flow";
import { Inspector } from "../tx/Inspector";
import { LiveState } from "../tx/Live";
import { place } from "../tx/state";
import { confirmations, features, isCoinbase, lockTimeMeaning, vsize } from "../tx/tx";
import { MockFlow } from "./MockFlow";
import "../tx/TransactionPage.css";
import "./MockTx.css";

/** One recorded answer set: what the real page reads over HTTP and the `tx:` topic. */
interface Sample {
  recorded: number | null;
  tip: number;
  tx: Transaction;
  outspends: Outspend[];
  hex: string;
  topic?: {
    time: number;
    rate: number;
    position: {
      block: number;
      blocks: number;
      effective_rate: number;
      ahead_vsize: number;
      ahead_txs: number;
    } | null;
  };
}

const SAMPLES: Record<string, { name: string; load: () => Promise<{ default: unknown }> }> = {
  owner: { name: "Waiting", load: () => import("./samples/owner.json") },
  "owner-confirmed": {
    name: "Same, confirmed",
    load: () => import("./samples/owner-confirmed.json"),
  },
  batch: { name: "21 outputs", load: () => import("./samples/batch.json") },
  consolidation: { name: "141 inputs", load: () => import("./samples/consolidation.json") },
};

export default function MockTx() {
  usePageTitle(() => "Transaction (mockup)");
  const [search] = useSearchParams();
  const id = createMemo(() => {
    const q = search["tx"];
    return typeof q === "string" && q in SAMPLES ? q : "owner";
  });
  const [sample, setSample] = createSignal<{ id: string; s: Sample }>();
  createEffect(id, (k) => {
    void SAMPLES[k]?.load().then((m) => setSample({ id: k, s: m.default as Sample }));
  });
  return (
    <div class="wrap tx-page mtx">
      <Show when={sample()} keyed>
        {(x) => <View s={x.s} />}
      </Show>
      <nav class="mtx-samples" aria-label="Mockup samples">
        <span>Mockup on recorded data:</span>
        <For each={Object.entries(SAMPLES)}>
          {([k, v]) => (
            <Link
              href={k === "owner" ? "/mock/tx" : `/mock/tx?tx=${k}`}
              aria-current={id() === k ? "page" : undefined}
            >
              {v.name}
            </Link>
          )}
        </For>
      </nav>
    </div>
  );
}

const ICONS = {
  positive: <path d="M4.5 8.5l2.4 2.4L11.8 5.6" />,
  caution: <circle cx="8" cy="8" r="5.5" stroke-dasharray="2.6 2" />,
};

function View(props: { s: Sample }) {
  const network = useNetwork();
  const tx = () => props.s.tx;
  const confirmed = () => tx().status.confirmed;
  const position = (): Position | null => {
    const p = props.s.topic?.position;
    return p
      ? {
          block: p.block,
          blocks: p.blocks,
          effectiveRate: p.effective_rate / 1000,
          aheadVsize: p.ahead_vsize,
          aheadTxs: p.ahead_txs,
        }
      : null;
  };
  const confs = () => confirmations(tx().status.block_height, props.s.tip);
  const v = () => vsize(tx());
  const rate = () => {
    const size = v();
    return !isCoinbase(tx()) && tx().fee !== undefined && size !== undefined && size !== 0
      ? (tx().fee ?? 0) / size
      : undefined;
  };
  const amount = () => tx().vout.reduce((a, o) => a + o.value, 0);
  const lock = () => lockTimeMeaning(tx().locktime, tx().vin);
  const [selected, setSelected] = createSignal<Selection | null>(null);
  const [hex, setHex] = createSignal(false);
  let rail: HTMLElement | undefined;
  const select = (s: Selection) => {
    const cur = selected();
    setSelected(cur && cur.side === s.side && cur.index === s.index ? null : s);
    // On a phone the rail is under the flow: bring what opened into view.
    if (matchMedia("(max-width: 65em)").matches) {
      requestAnimationFrame(() => rail?.scrollIntoView({ block: "nearest" }));
    }
  };
  const ins = () => tx().vin?.length ?? 0;
  const outs = () => tx().vout.length;
  const plural = (n: number, w: string) => `${groupDigits(n)} ${w}${n === 1 ? "" : "s"}`;

  return (
    <>
      <header class="tx-head">
        <div class="tx-head__row">
          <h1>Transaction</h1>
          <span class={`tx-status tx-status--${confirmed() ? "positive" : "caution"}`}>
            <svg class="tx-icon" viewBox="0 0 16 16" aria-hidden="true">
              {confirmed() ? ICONS.positive : ICONS.caution}
            </svg>
            {confirmed() ? "Confirmed" : "Unconfirmed"}
          </span>
          <Show when={!confirmed()}>
            <LiveState liveness="live" network="Mainnet" />
          </Show>
        </div>
        <HashFull value={tx().txid} copyLabel="Copy transaction ID" />
      </header>

      {/* One panel answers: where it is, what it paid, what it moved, and when. */}
      <dl class="mtx-sum panel" aria-label="Summary">
        <div class="mtx-sum__cell mtx-sum__cell--where">
          <Show
            when={confirmed()}
            fallback={
              <Show
                when={position()}
                fallback={
                  <>
                    <dt>Projected</dt>
                    <dd>
                      <span class="mtx-sum__value">{MISSING}</span>
                    </dd>
                  </>
                }
              >
                {(p) => (
                  <>
                    <dt>Projected</dt>
                    <dd>
                      <Link
                        class="mtx-sum__value tap"
                        href={paths.projected(place(p(), network()).page)}
                      >
                        {p().block === 0
                          ? "Next block"
                          : p().block >= p().blocks - 1
                            ? `${p().blocks - 1}+ blocks`
                            : `~${p().block + 1} blocks`}
                      </Link>
                      <Strip
                        slots={Array.from({ length: p().blocks }, (_, i) => ({
                          here: p().blocks - 1 - i === p().block,
                        }))}
                        mined={[]}
                        color={feeColor(p().effectiveRate)}
                      />
                      <span class="mtx-sum__sub" title={formatSize(p().aheadVsize)}>
                        {plural(p().aheadTxs, "tx")} ahead
                      </span>
                    </dd>
                  </>
                )}
              </Show>
            }
          >
            <dt>Block</dt>
            <dd>
              <Link
                class="mtx-sum__value tap"
                href={paths.block(tx().status.block_hash ?? tx().status.block_height ?? "")}
              >
                <span class="visually-hidden">block </span>
                <span class="num">{groupDigits(tx().status.block_height ?? Number.NaN)}</span>
              </Link>
              <Strip
                slots={Array.from({ length: Math.max(0, 6 - (confs() ?? 0)) }, () => ({
                  here: false,
                }))}
                mined={Array.from({ length: Math.min(6, confs() ?? 0) }, (_, i) => ({
                  here: i === Math.min(6, confs() ?? 0) - 1,
                }))}
                color={feeColor(rate() ?? 0)}
              />
              <span class="mtx-sum__sub">
                {(confs() ?? 0) < 6
                  ? `${groupDigits(confs() ?? 0)} of 6 confirmations`
                  : plural(confs() ?? 0, "confirmation")}
              </span>
            </dd>
          </Show>
        </div>
        <div class="mtx-sum__cell">
          <dt>Fee rate</dt>
          <dd>
            <span class="mtx-sum__value">
              <Show when={rate() !== undefined} fallback={isCoinbase(tx()) ? "None" : MISSING}>
                <FeeRate rate={rate() ?? 0} />
              </Show>
            </span>
            <span class="mtx-sum__sub">
              <Sats sats={tx().fee ?? 0} />,{" "}
              <span class="mtx-nowrap">{v() === undefined ? MISSING : formatSize(v() ?? 0)}</span>
            </span>
          </dd>
        </div>
        <div class="mtx-sum__cell mtx-sum__cell--amount">
          <dt>Amount</dt>
          <dd>
            <span class="mtx-sum__value">
              <Amount sats={amount()} />
            </span>
            <span class="mtx-sum__sub">
              {plural(ins(), "input")} to {plural(outs(), "output")}
            </span>
          </dd>
        </div>
        <div class="mtx-sum__cell">
          <dt>{confirmed() ? "Mined" : "First seen"}</dt>
          <dd>
            <Show
              when={confirmed() ? tx().status.block_time : props.s.topic?.time}
              fallback={<span class="mtx-sum__value">{MISSING}</span>}
            >
              {(t) => (
                <>
                  <span class="mtx-sum__value">
                    <TimeAgo time={t()} />
                  </span>
                  <span class="mtx-sum__sub">
                    <TimeUtc time={t()} />
                  </span>
                </>
              )}
            </Show>
          </dd>
        </div>
      </dl>
      <More label={confirmed() ? "When it is final" : "How this changes"}>
        <Show
          when={!confirmed() && position()}
          fallback={
            <p>
              Most services treat six confirmations as final: each block on top makes it harder to
              undo.
            </p>
          }
        >
          {(p) => (
            <>
              <p>{place(p(), network()).ahead}</p>
              <p>{place(p(), network()).when}</p>
              <p>
                A projection, not a promise: miners pick their own blocks, and anything that pays
                more goes ahead of it. Until it confirms it can be replaced by a transaction paying
                more (full replace-by-fee).
              </p>
            </>
          )}
        </Show>
      </More>

      <div class="mtx-main">
        <section class="mtx-main__flow" aria-labelledby="mtx-flow-title">
          <SectionHeader title="Inputs and outputs" id="mtx-flow-title" />
          <MockFlow
            tx={tx()}
            outspends={props.s.outspends}
            selected={selected()}
            onSelect={select}
          />
        </section>

        <aside
          class="mtx-rail"
          ref={(el) => {
            rail = el;
          }}
        >
          <Switch>
            <Match when={selected()} keyed>
              {(s) => (
                <Inspector
                  tx={tx()}
                  selected={s}
                  outspends={() => props.s.outspends}
                  onClose={() => setSelected(null)}
                  ref={() => undefined}
                />
              )}
            </Match>
            <Match when={true}>
              <section class="mtx-details" aria-labelledby="mtx-details-title">
                <SectionHeader title="Details" id="mtx-details-title" />
                <dl class="mtx-facts">
                  <Fact label="Size">
                    <span class="num">{formatSize(tx().size ?? 0, "B")}</span>
                  </Fact>
                  <Fact label="Weight">
                    <span class="num">{formatSize(tx().weight ?? 0, "WU")}</span>
                  </Fact>
                  <Fact label="Replaceable">
                    {confirmed() ? "No: it is confirmed" : "Yes, until it confirms"}
                  </Fact>
                  <Fact label="Version">
                    <span class="num">{tx().version}</span>
                  </Fact>
                  <Fact label="Witness">{features(tx())}</Fact>
                  <Fact label="Lock time" sub={lock().detail}>
                    <span class="num">{lock().value}</span>
                  </Fact>
                  <Fact label="Raw hex" sub={formatSize(tx().size ?? 0, "B")}>
                    <button
                      class="btn mtx-facts__btn"
                      type="button"
                      aria-expanded={hex() ? "true" : "false"}
                      onClick={() => setHex((h) => !h)}
                    >
                      {hex() ? "Hide" : "Show"}
                    </button>
                  </Fact>
                </dl>
                <Show when={hex()}>
                  <Code label="Raw hex" value={props.s.hex} bytes={props.s.hex.length / 2} />
                </Show>
              </section>
            </Match>
          </Switch>
        </aside>
      </div>
    </>
  );
}

function Fact(props: { label: string; sub?: string; children: JSX.Element }) {
  return (
    <div class="mtx-fact">
      <dt>{props.label}</dt>
      <dd>
        {props.children}
        <Show when={props.sub}>
          <span class="mtx-fact__sub">{props.sub}</span>
        </Show>
      </dd>
    </div>
  );
}

/**
 * The block strip in small: projected slots dashed to the left of the "now" line, mined blocks
 * solid to its right, and the transaction one square in its fee colour. Waiting, it sits left of
 * the line; once mined it has crossed it, and the blocks found since stack up between.
 */
function Strip(props: { slots: { here: boolean }[]; mined: { here: boolean }[]; color: string }) {
  return (
    <span class="mtx-strip" aria-hidden="true" style={{ "--c": props.color }}>
      <For each={props.slots}>
        {(s) => <span class={["mtx-strip__slot", { "is-here": s.here }]} />}
      </For>
      <span class="mtx-strip__now" />
      <For each={props.mined}>
        {(s) => <span class={["mtx-strip__slot mtx-strip__slot--mined", { "is-here": s.here }]} />}
      </For>
    </span>
  );
}
