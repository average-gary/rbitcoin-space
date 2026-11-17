import { describe, expect, it } from "vitest";
import type { Transaction } from "../../lib/esplora";
import genesis from "../mock-tx-text/samples/genesis.json";
import image from "../mock-tx-text/samples/inscription-image.json";
import text from "../mock-tx-text/samples/inscription-text.json";
import { coinbaseText, envelope, inputText, inscriptionOf } from "./chaintext";

const tx = (s: unknown) => (s as { tx: Transaction }).tx;

describe("chain text", () => {
  it("reads a text inscription past its other fields", () => {
    const vin = tx(text).vin?.[0];
    if (!vin) throw new Error("no input");
    expect(inscriptionOf(vin)?.contentType).toBe("text/plain;charset=utf-8");
    const first = inputText(vin)?.parts?.[0];
    expect(first && "text" in first ? first.text : "").toContain('"p":"brc-20"');
  });
  it("names an image inscription without its content", () => {
    const vin = tx(image).vin?.[0];
    if (!vin) throw new Error("no input");
    expect(inputText(vin)).toStrictEqual({
      label: "Inscription",
      parts: null,
      about: "image/png, 793 B",
    });
  });
  it("needs a closed envelope", () => {
    // OP_FALSE OP_IF "ord" OP_1 "text/plain" OP_0 "hi", no OP_ENDIF.
    expect(envelope("0063036f7264510a746578742f706c61696e00026869")).toBeNull();
    expect(envelope("0063036f7264510a746578742f706c61696e0002686968")).toStrictEqual({
      contentType: "text/plain",
      body: new TextEncoder().encode("hi"),
    });
  });
  it("reads the genesis headline without the push bytes", () => {
    const parts = coinbaseText(tx(genesis))?.parts ?? [];
    expect(parts.at(-1)).toStrictEqual({
      text: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks",
    });
    expect("hidden" in (parts[0] ?? {})).toBe(false);
  });
});
