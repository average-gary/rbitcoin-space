// Text people put on the chain, read for the flow cards and the inspector: a coinbase's free bytes,
// an OP_RETURN's data and an ordinals inscription's body. All of it is attacker-controlled: the
// results are plain strings for text nodes, with hidden characters made visible. Never images.
import type { Transaction, Vin, Vout } from "../../lib/esplora";
import { formatSize, groupDigits } from "../../lib/format";
import { coinbaseTag, type TagPart } from "../block/chain";
import { classify, hexToBytes, isText, opReturnData, ops, printable } from "./script";

/** Characters of text a card is given; CSS cuts it to its lines, the inspector shows it whole. */
const CARD_CHARS = 240;

export interface ChainText {
  /** "Coinbase", "OP_RETURN" or "Inscription". */
  label: string;
  /** The text, when there is some; hidden runs are counted, not shown. */
  parts: TagPart[] | null;
  /** What a payload that is not text is, such as "image/png, 793 B" or "44 bytes". */
  about: string | null;
}

/** An inscription as its envelope declares it. */
export interface Inscription {
  /** Tag 1, as visible text; empty when the envelope names none. */
  contentType: string;
  body: Uint8Array;
}

const ORD = [0x6f, 0x72, 0x64];

/** A field's tag: a one-byte push, or OP_1 to OP_16. */
const tagOf = (o: { op: number; data?: Uint8Array }): number | null =>
  o.data?.length === 1 ? (o.data[0] ?? null) : o.op >= 0x51 && o.op <= 0x60 ? o.op - 0x50 : null;

/**
 * The first ordinals envelope in a tapscript: `OP_FALSE OP_IF "ord"`, then tag and value pushes,
 * then an empty push and the body's pushes joined, closed by `OP_ENDIF`. Null when there is none.
 */
export function envelope(scriptHex: string): Inscription | null {
  const all = [...ops(hexToBytes(scriptHex))];
  for (let i = 0; i + 2 < all.length; i++) {
    const ord = all[i + 2]?.data;
    if (all[i]?.op !== 0 || all[i + 1]?.op !== 0x63 || !ord) continue;
    if (ord.length !== 3 || ORD.some((b, k) => ord[k] !== b)) continue;
    let contentType = "";
    const body: Uint8Array[] = [];
    let inBody = false;
    for (let k = i + 3; k < all.length; k++) {
      const o = all[k];
      if (!o || o.truncated) return null;
      if (o.op === 0x68) {
        const out = new Uint8Array(body.reduce((a, c) => a + c.length, 0));
        let at = 0;
        for (const c of body) {
          out.set(c, at);
          at += c.length;
        }
        return { contentType, body: out };
      }
      if (inBody) {
        if (o.data) body.push(o.data);
        continue;
      }
      // An empty push ends the fields; the body follows.
      if (o.op === 0 || o.data?.length === 0) {
        inBody = true;
        continue;
      }
      const value = all[k + 1];
      k++;
      if (tagOf(o) === 1 && value?.data && contentType === "")
        contentType = printable(value.data, 100).text;
    }
    return null;
  }
  return null;
}

/** The script a taproot script-path spend reveals: the item before the control block (and annex). */
export function tapscript(vin: Vin): string | null {
  if (vin.prevout && classify(vin.prevout.scriptpubkey).kind !== "p2tr") return null;
  const w = vin.witness ?? [];
  const stack = w.length > 1 && w.at(-1)?.startsWith("50") ? w.slice(0, -1) : w;
  return stack.length >= 2 ? (stack.at(-2) ?? null) : null;
}

/** The inscription an input reveals, if any. */
export function inscriptionOf(vin: Vin): Inscription | null {
  const s = tapscript(vin);
  return s ? envelope(s) : null;
}

/** Whether an inscription is text we show: a `text/*` type whose body reads as text. */
export const isTextInscription = (i: Inscription): boolean =>
  /^text\//i.test(i.contentType) && isText(i.body);

const asParts = (bytes: Uint8Array, max: number): TagPart[] => [
  { text: printable(bytes, max).text },
];

/**
 * Keeps only the words: a fragment with no run of four letters or digits is a stray byte of an
 * extranonce that happened to decode, so it counts as hidden instead.
 * shortcut: a heuristic tuned on two coinbases; check it against a wider set of pool tags before building.
 */
function words(parts: TagPart[]): TagPart[] {
  const out: TagPart[] = [];
  for (const p of parts) {
    const q: TagPart =
      "text" in p && !/[\p{L}\p{N}]{4}/u.test(p.text) ? { hidden: p.text.length } : p;
    const last = out.at(-1);
    if (last && "hidden" in last && "hidden" in q) last.hidden += q.hidden;
    else out.push({ ...q });
  }
  // A long hidden run after the words is the extranonce; what follows it is chance, not text.
  const cut = out.findIndex((p, k) => k > 0 && "hidden" in p && p.hidden >= 8);
  return cut === -1 ? out : out.slice(0, cut);
}

/** Drops hidden runs at either end: push lengths and padding, not part of what was written. */
function trimHidden(parts: TagPart[]): TagPart[] {
  let a = 0;
  let b = parts.length;
  while (a < b && "hidden" in (parts[a] ?? {})) a++;
  while (b > a && "hidden" in (parts[b - 1] ?? {})) b--;
  return parts.slice(a, b);
}

/** A coinbase's free text, read push by push as the block page reads it. */
export function coinbaseText(tx: Transaction): ChainText | null {
  const vin = tx.vin?.[0];
  if (!vin?.is_coinbase) return null;
  const tag = coinbaseTag(vin.scriptsig, tx.status?.block_height ?? -1);
  return {
    label: "Coinbase",
    parts: tag?.readable ? trimHidden(words(tag.parts)) : null,
    about: null,
  };
}

/** An input's inscription, as text or as what it is. */
export function inputText(vin: Vin, max = CARD_CHARS): ChainText | null {
  const ins = inscriptionOf(vin);
  if (!ins) return null;
  if (isTextInscription(ins))
    return { label: "Inscription", parts: asParts(ins.body, max), about: null };
  const size = formatSize(ins.body.length, "B");
  return {
    label: "Inscription",
    parts: null,
    about: ins.contentType ? `${ins.contentType}, ${size}` : size,
  };
}

/** An OP_RETURN output's data, as text or as its size. */
export function outputText(out: Vout, max = CARD_CHARS): ChainText | null {
  if (classify(out.scriptpubkey).kind !== "op_return") return null;
  const data = opReturnData(out.scriptpubkey);
  if (isText(data)) return { label: "OP_RETURN", parts: asParts(data, max), about: null };
  return {
    label: "OP_RETURN",
    parts: null,
    about: data.length > 0 ? `${groupDigits(data.length)} bytes` : null,
  };
}
