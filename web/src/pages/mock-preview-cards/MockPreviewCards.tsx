// MOCKUP, never merged: every link preview card at full size, each beside how a chat app shows it,
// on a dark chat and a light one. The cards are drawn from sample.json, recorded once with GETs.
import { For } from "solid-js";
import { usePageTitle } from "../../lib/page";
import { DIRECTIONS, linkOf, SUBJECTS, type Subject } from "./cards";
import "./MockPreviewCards.css";

const NAMES: Record<Subject, string> = {
  tx: "Transaction, confirmed",
  "tx-unconfirmed": "Transaction, unconfirmed",
  block: "Block",
  address: "Address",
};

function Chat(props: { theme: "dark" | "light"; id: string; s: Subject; children: unknown }) {
  const link = linkOf(props.s);
  return (
    <div class={`pc-chat pc-chat--${props.theme}`} id={props.id}>
      <div class="pc-bubble">
        <p class="pc-url">{`rbitcoin.space/${link.path.slice(0, 30)}…`}</p>
        <div class="pc-preview">
          {props.children as never}
          <p class="pc-site">rbitcoin.space</p>
          <p class="pc-title">{link.title}</p>
        </div>
      </div>
    </div>
  );
}

export default function MockPreviewCards() {
  usePageTitle(() => "Link preview cards (mockup)");
  return (
    <div class="pc">
      <header class="pc-head">
        <h1>Link preview cards</h1>
        <p>Mockup. Each card is 1200 × 630, beside it as a chat app shows it, about 460 px wide.</p>
      </header>
      <For each={DIRECTIONS}>
        {(d) => (
          <section class="pc-direction" id={`dir-${d.key}`}>
            <h2>{d.name}</h2>
            <dl class="pc-notes">
              <dt>Idea</dt>
              <dd>{d.idea}</dd>
              <dt>Theme</dt>
              <dd>{`${d.theme}. ${d.why}`}</dd>
              <dt>Hardest to draw</dt>
              <dd>{d.hard}</dd>
            </dl>
            <For each={SUBJECTS}>
              {(s) => (
                <figure class="pc-row">
                  <figcaption>{NAMES[s]}</figcaption>
                  <div class="pc-full" id={`card-${d.key}-${s}`}>
                    <d.Card s={s} />
                  </div>
                  <div class="pc-chats">
                    <Chat theme="dark" id={`chat-${d.key}-${s}-dark`} s={s}>
                      <d.Card s={s} width={460} />
                    </Chat>
                    <Chat theme="light" id={`chat-${d.key}-${s}-light`} s={s}>
                      <d.Card s={s} width={460} />
                    </Chat>
                  </div>
                </figure>
              )}
            </For>
          </section>
        )}
      </For>
    </div>
  );
}
