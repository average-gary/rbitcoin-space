// A coinbase laid out as the Stratum V2 reference implementation writes it names its pool in the
// tag's pool field only; the miner field is the miner's own words (docs/API.md "Who mined a
// block"). Such a block carries the Stratum V2 mark beside its miner, named or not. This submits
// such blocks, built by hand (`regtest.py tagged`), so it runs after every other test (the `mines`
// project), and holds the pages showing the mark to the layout rules the sweeps ran without it.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { layoutFaults } from "./layout";
import { tablesFit } from "./rows";
import { smallTargets } from "./targets";

const REGTEST = fileURLToPath(new URL("../../dev/regtest/regtest.py", import.meta.url));
// Mainnet block 976,280's tag, and one whose miner field holds a listed pool's tag.
const POOL_TAG = "Sv2/MARA🇺🇸🇺🇸//";
const MINER_TAG = "Sv2//Foundry USA Pool/";
// A pool with a short name (DCEX, tagged `/DCEX/`), in the Stratum V2 layout and out of it.
const SHORT_TAG = "Sv2/DCEX//";
const SHORT_PLAIN_TAG = "/DCEX/";

/** One hand-built block per tag, each ending in a 20-byte extranonce as the layout asks. */
function tagged(...tags: string[]): { block: string }[] {
  return JSON.parse(
    execFileSync("python3", [REGTEST, "tagged", "--extranonce", "20", ...tags], {
      encoding: "utf8",
    }),
  ) as { block: string }[];
}

/**
 * Each marked row of the blocks list: where taps on its mark land (by the link found there), and
 * how far its name's target reaches past its row, in px.
 */
function marks(page: Page) {
  return page.locator("tbody").evaluate((tbody) =>
    [...tbody.querySelectorAll("tr")].flatMap((tr) => {
      const chip = tr.querySelector(".block-sv2");
      const link = tr.querySelector(".blocks-miner");
      if (chip === null || link === null) return [];
      tr.scrollIntoView({ block: "center" });
      const row = tr.getBoundingClientRect();
      const target = link.getBoundingClientRect();
      const b = chip.getBoundingClientRect();
      const at = (fx: number, fy: number) =>
        document
          .elementFromPoint(b.x + b.width * fx, b.y + b.height * fy)
          ?.closest("a")
          ?.getAttribute("href");
      return [
        {
          name: link.textContent ?? "",
          pool: link.getAttribute("href"),
          lands: [
            ...new Set([0.02, 0.5, 0.98].flatMap((x) => [0.05, 0.5, 0.95].map((y) => at(x, y)))),
          ],
          out: Math.max(row.top - target.top, target.bottom - row.bottom),
        },
      ];
    }),
  );
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
  const mark = named.getByRole("button", { name: "Sv2", exact: true });
  const note =
    /^Stratum V2 coinbase tag\. The coinbase is laid out as .* not something the chain proves\.$/;
  // Named by its word alone: the note is its description, never part of its name.
  await expect(mark).toHaveAccessibleName("Sv2");
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
  await expect(unnamed.getByRole("button", { name: "Sv2", exact: true })).toBeVisible();

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

  test("the mark costs a row no height and a thumb reaches its note", async ({
    page,
    mine,
    browserName,
  }) => {
    const [ordinary] = await mine(1);
    const [short, shortPlain, pool] = tagged(SHORT_TAG, SHORT_PLAIN_TAG, POOL_TAG);
    if (
      pool === undefined ||
      short === undefined ||
      shortPlain === undefined ||
      ordinary === undefined
    )
      throw new Error("the harness made four blocks");
    await landed(page.request, pool.block);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/regtest/blocks");
    const rows = page
      .getByRole("table", { name: "Recent blocks, newest first" })
      .locator("tbody tr");
    await expect(rows.first().getByRole("link", { name: "MARA Pool" })).toBeVisible();
    await expect(rows.first().getByText("Stratum V2")).toHaveCount(1);
    await expect(rows.nth(1).getByRole("link", { name: "DCEX" })).toBeVisible();
    await expect(rows.nth(1).getByText("Stratum V2")).toHaveCount(0);
    // The short marked name's row too, so nothing is measured before its summary arrives.
    await expect(rows.nth(2).getByRole("link", { name: "DCEX" })).toBeVisible();
    await expect(rows.nth(2).getByText("Stratum V2")).toHaveCount(1);
    const faults: string[] = [];
    // A marked name's target covers its whole mark and stays in its row at the default text size,
    // a small one (where a row is short) and a large one (where the mark outgrows a short name).
    // Chromium alone lets a test set the text size.
    const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : undefined;
    const textSize = (px: number) =>
      cdp?.send("Page.setFontSizes", {
        fontSizes: { standard: px, fixed: Math.round((px * 13) / 16) },
      });
    for (const text of cdp ? [16, 12, 24] : [16]) {
      await textSize(text);
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const at = `${width} px with ${text} px text`;
        // The layout checks first, from the top: measuring the marks scrolls the page.
        await page.evaluate(() => window.scrollTo(0, 0));
        if (text === 16) {
          await tablesFit(page, `the blocks list at ${at}`);
          for (const f of await layoutFaults(page)) faults.push(`the list at ${at}: ${f}`);
          for (const f of await smallTargets(page, "main")) faults.push(`the list at ${at}: ${f}`);
        }
        const [marked, plain] = await Promise.all([
          rows.first().boundingBox(),
          rows.nth(1).boundingBox(),
        ]);
        expect(marked?.height, `a marked row's height at ${at}`).toBe(plain?.height);
        for (const m of await marks(page)) {
          if (m.lands.length !== 1 || m.lands[0] !== m.pool)
            faults.push(`${m.name}'s mark at ${at} opens ${m.lands.join(" and ")}`);
          if (m.out > 0.5)
            faults.push(`${m.name}'s target at ${at} leaves its row by ${m.out.toFixed(1)} px`);
        }
      }
    }
    await textSize(16);
    expect(faults, "the blocks list").toStrictEqual([]);
    // A real tap on the mark's lowest row of pixels opens the pool's page.
    await rows.first().evaluate((tr) => tr.scrollIntoView({ block: "center" }));
    const chip = await rows.first().locator(".block-sv2").boundingBox();
    if (chip === null) throw new Error("no mark");
    await page.touchscreen.tap(chip.x + chip.width / 2, chip.y + chip.height - 1);
    await expect(page).toHaveURL(/\/regtest\/mining\/pool\/marapool$/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/regtest/block/${pool.block}`);
    const fact = page.getByRole("definition").filter({ hasText: "By payout address or tag" });
    const mark = fact.getByRole("button", { name: "Sv2", exact: true });
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

    // A short name's link is a thumb's width, marked or not; unmarked, it fills its line as every
    // value's link does.
    for (const [block, marked] of [
      [short.block, true],
      [shortPlain.block, false],
    ] as const) {
      await page.goto(`/regtest/block/${block}`);
      const named = page.getByRole("definition").filter({ hasText: "By payout address or tag" });
      const link = named.getByRole("link");
      await expect(link).toHaveText("DCEX");
      await expect(named.getByRole("button", { name: "Sv2", exact: true })).toHaveCount(
        marked ? 1 : 0,
      );
      await expect(page.locator("main [aria-busy='true'], main .skel")).toHaveCount(0);
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const where = `DCEX's block${marked ? ", marked," : ""} at ${width} px`;
        if (!marked) {
          const [own, line] = await link.evaluate((a) => [
            a.getBoundingClientRect().width,
            a.parentElement?.getBoundingClientRect().width,
          ]);
          expect(own, where).toBe(line);
        }
        for (const f of await smallTargets(page, ".block-facts")) faults.push(`${where}: ${f}`);
      }
    }
    expect(faults).toStrictEqual([]);
  });
});
