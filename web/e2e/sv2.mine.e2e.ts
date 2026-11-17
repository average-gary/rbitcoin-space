// A coinbase laid out as the Stratum V2 reference implementation writes it names its pool in the
// tag's pool field only; the miner field is the miner's own words (docs/API.md "Who mined a
// block"). Such a block carries the Stratum V2 mark beside its miner, named or not. This submits
// such blocks, built by hand (`regtest.py tagged`), so it runs after every other test (the `mines`
// project), and holds the pages showing the mark to the layout rules the sweeps ran without it.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { layoutFaults } from "./layout";
import { tablesFit } from "./rows";
import { smallTargets } from "./targets";

const REGTEST = fileURLToPath(new URL("../../dev/regtest/regtest.py", import.meta.url));
// Mainnet block 976,280's tag, and one whose miner field holds a listed pool's tag.
const POOL_TAG = "Sv2/MARA🇺🇸🇺🇸//";
const MINER_TAG = "Sv2//Foundry USA Pool/";

/** One hand-built block per tag, each ending in a 20-byte extranonce as the layout asks. */
function tagged(...tags: string[]): { block: string }[] {
  return JSON.parse(
    execFileSync("python3", [REGTEST, "tagged", "--extranonce", "20", ...tags], {
      encoding: "utf8",
    }),
  ) as { block: string }[];
}

/** Waits until the list the pages read begins with `block`: the server reuses it for a second. */
async function landed(request: APIRequestContext, block: string) {
  await expect
    .poll(async () => {
      const list = (await (await request.get("/regtest/api/blocks")).json()) as { id: string }[];
      return list[0]?.id;
    })
    .toBe(block);
}

test("a Stratum V2 block is its pool field's pool, never its miner field's, and is marked", async ({
  page,
  mine,
}) => {
  // Mines first through the fixture, so this fails clearly anywhere but the `mines` project.
  const [ordinary] = await mine(1);
  const [pool, miner] = tagged(POOL_TAG, MINER_TAG);
  if (pool === undefined || miner === undefined || ordinary === undefined) {
    throw new Error("the harness made three blocks");
  }
  await landed(page.request, miner.block);

  await page.goto(`/regtest/block/${pool.block}`);
  const tag = page.getByRole("definition").filter({ hasText: "Written by the miner" });
  await expect(tag).toContainText(POOL_TAG);
  const named = page.getByRole("definition").filter({ hasText: "By payout address or tag" });
  await expect(named.getByRole("link")).toHaveText("MARA Pool");
  await expect(named.getByRole("link")).toHaveAttribute("href", "/regtest/mining/pool/marapool");
  // The mark, and what it rests on: said to a screen reader, and shown on focus.
  const mark = named.getByRole("button", { name: "Sv2" });
  const note =
    /^Stratum V2 coinbase tag\. The coinbase is laid out as .* not something the chain proves\.$/;
  await expect(mark).toHaveAccessibleDescription(note);
  const shown = page.getByText("Sv2/<pool tag>/<miner tag>/").filter({ visible: true });
  await expect(shown).toHaveCount(1);
  await mark.focus();
  await expect(shown).toHaveCount(2);
  await expect(shown.last()).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(shown).toHaveCount(1);
  expect(await layoutFaults(page), "a marked block's page").toStrictEqual([]);

  // Marked whoever mined it: the layout alone decides.
  await page.goto(`/regtest/block/${miner.block}`);
  await expect(tag).toContainText(MINER_TAG);
  const unnamed = page.getByRole("definition").filter({ hasText: "No listed address or tag" });
  await expect(unnamed.getByRole("link")).toHaveText("Unknown");
  await expect(unnamed.getByRole("button", { name: "Sv2" })).toBeVisible();

  await page.goto(`/regtest/block/${ordinary}`);
  await expect(unnamed.getByRole("link")).toHaveText("Unknown");
  await expect(page.getByRole("button", { name: "Sv2" })).toHaveCount(0);

  // The list's newest three rows are those blocks, newest first: the two are marked, by name.
  await page.goto("/regtest/blocks");
  const rows = page.getByRole("table", { name: "Recent blocks, newest first" }).locator("tbody tr");
  for (const [i, block] of [miner.block, pool.block, ordinary].entries()) {
    const row = rows.nth(i);
    await expect(row.getByRole("link").first()).toHaveAttribute("href", `/regtest/block/${block}`);
    await expect(row.getByRole("link", { name: i === 1 ? "MARA Pool" : "Unknown" })).toBeVisible();
    await expect(row.getByText("Stratum V2")).toHaveCount(block === ordinary ? 0 : 1);
  }
  await tablesFit(page, "the blocks list with marked rows");
  expect(await layoutFaults(page), "the blocks list with marked rows").toStrictEqual([]);
});

test.describe("on a phone", () => {
  // A touch screen: `(pointer: coarse)` gives the controls their targets. Firefox has no mobile
  // emulation, only touch.
  test.use({
    hasTouch: true,
    ...(process.env["E2E_ENGINE"] === "firefox" ? {} : { isMobile: true }),
  });

  test("the mark costs a row no height and a thumb reaches its note", async ({ page, mine }) => {
    const [ordinary] = await mine(1);
    const [pool] = tagged(POOL_TAG);
    if (pool === undefined || ordinary === undefined)
      throw new Error("the harness made two blocks");
    await landed(page.request, pool.block);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/regtest/blocks");
    const rows = page
      .getByRole("table", { name: "Recent blocks, newest first" })
      .locator("tbody tr");
    await expect(rows.first().getByRole("link", { name: "MARA Pool" })).toBeVisible();
    await expect(rows.first().getByText("Stratum V2")).toHaveCount(1);
    await expect(rows.nth(1).getByRole("link", { name: "Unknown" })).toBeVisible();
    await expect(rows.nth(1).getByText("Stratum V2")).toHaveCount(0);
    const faults: string[] = [];
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await tablesFit(page, `the blocks list at ${width} px`);
      const [marked, plain] = await Promise.all([
        rows.first().boundingBox(),
        rows.nth(1).boundingBox(),
      ]);
      expect(marked?.height, `a marked row's height at ${width} px`).toBe(plain?.height);
      for (const f of await layoutFaults(page)) faults.push(`the list at ${width} px: ${f}`);
      for (const f of await smallTargets(page, "main"))
        faults.push(`the list at ${width} px: ${f}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/regtest/block/${pool.block}`);
    const fact = page.getByRole("definition").filter({ hasText: "By payout address or tag" });
    const mark = fact.getByRole("button", { name: "Sv2" });
    await expect(mark).toBeVisible();
    await expect(page.locator("main [aria-busy='true'], main .skel")).toHaveCount(0);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      // The mark takes none of the name: it is whole, not cut to make room.
      const name = fact.getByRole("link");
      await expect(name).toHaveText("MARA Pool");
      expect(await name.evaluate((a) => a.scrollWidth <= a.clientWidth), `${width} px`).toBe(true);
      for (const f of await layoutFaults(page)) faults.push(`the block at ${width} px: ${f}`);
      for (const f of await smallTargets(page, ".block-facts")) {
        faults.push(`the block at ${width} px: ${f}`);
      }
    }
    expect(faults).toStrictEqual([]);

    // A tap opens the note, whole on the screen.
    const shown = page.getByText("Sv2/<pool tag>/<miner tag>/").filter({ visible: true });
    await mark.scrollIntoViewIfNeeded();
    await mark.tap();
    await expect(shown).toHaveCount(2);
    await expect(shown.last()).toBeInViewport({ ratio: 1 });
  });
});
