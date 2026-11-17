// MOCKUP, never merged: the real flow and inspector on transactions recorded from the public
// site (samples/), so the owner can see where chain text sits. `?tx=<sample>&sel=in:0` opens one.
import { useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Link } from "../../components/Link";
import { SectionHeader } from "../../components/SectionHeader";
import type { Outspend, Transaction } from "../../lib/esplora";
import { usePageTitle } from "../../lib/page";
import { Flow, type Selection } from "../tx/Flow";
import { Inspector } from "../tx/Inspector";
import "../tx/TransactionPage.css";
import "./MockTxText.css";

interface Sample {
  tx: Transaction;
  outspends: Outspend[];
}

const SAMPLES: Record<string, { name: string; load: () => Promise<{ default: unknown }> }> = {
  genesis: { name: "Genesis coinbase", load: () => import("./samples/genesis.json") },
  "coinbase-pool": { name: "Pool coinbase", load: () => import("./samples/coinbase-pool.json") },
  "opreturn-short": {
    name: "OP_RETURN, short",
    load: () => import("./samples/opreturn-short.json"),
  },
  "opreturn-long": { name: "OP_RETURN, long", load: () => import("./samples/opreturn-long.json") },
  "opreturn-binary": {
    name: "OP_RETURN, binary",
    load: () => import("./samples/opreturn-binary.json"),
  },
  "inscription-text": {
    name: "Inscription, text",
    load: () => import("./samples/inscription-text.json"),
  },
  "inscription-image": {
    name: "Inscription, image",
    load: () => import("./samples/inscription-image.json"),
  },
};

const parseSel = (v: unknown): Selection | null => {
  const m = typeof v === "string" ? /^(in|out):(\d+)$/.exec(v) : null;
  return m ? { side: m[1] === "in" ? "in" : "out", index: Number(m[2]) } : null;
};

export default function MockTxText() {
  usePageTitle(() => "Chain text (mockup)");
  const [search] = useSearchParams();
  const id = createMemo(() => {
    const q = search["tx"];
    return typeof q === "string" && q in SAMPLES ? q : "genesis";
  });
  const [sample, setSample] = createSignal<Sample>();
  createEffect(id, (k) => {
    void SAMPLES[k]?.load().then((m) => setSample(m.default as Sample));
  });
  return (
    <div class="wrap tx-page mtt">
      <nav class="mtt-samples" aria-label="Mockup samples">
        <For each={Object.entries(SAMPLES)}>
          {([k, v]) => (
            <Link href={`/mock/tx-text?tx=${k}`} aria-current={id() === k ? "page" : undefined}>
              {v.name}
            </Link>
          )}
        </For>
      </nav>
      <Show when={sample()} keyed>
        {(s) => <View s={s} initial={parseSel(search["sel"])} />}
      </Show>
    </div>
  );
}

function View(props: { s: Sample; initial: Selection | null }) {
  const [selected, setSelected] = createSignal<Selection | null>(props.initial);
  const select = (s: Selection) => {
    const cur = selected();
    setSelected(cur && cur.side === s.side && cur.index === s.index ? null : s);
  };
  return (
    <div class="tx-main">
      <section class="tx-main__flow" aria-labelledby="tx-flow-title">
        <SectionHeader title="Inputs and outputs" id="tx-flow-title" />
        <Flow
          tx={props.s.tx}
          outspends={() => props.s.outspends}
          selected={selected()}
          onSelect={select}
        />
      </section>
      <div class="tx-rail tx-rail--open">
        <Show when={selected()} keyed>
          {(s) => (
            <div class="tx-rail__over">
              <Inspector
                tx={props.s.tx}
                selected={s}
                outspends={() => props.s.outspends}
                onClose={() => setSelected(null)}
                ref={() => undefined}
              />
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
