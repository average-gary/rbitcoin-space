// A coinbase laid out as the Stratum V2 reference implementation writes it names its pool in the
// tag's pool field only; the miner field is the miner's own words (docs/API.md "Who mined a
// block"). This submits two such blocks, built by hand (`regtest.py tagged`), so it runs after
// every other test (the `mines` project).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";

const REGTEST = fileURLToPath(new URL("../../dev/regtest/regtest.py", import.meta.url));
// Mainnet block 976,280's tag, and one whose miner field holds a listed pool's tag.
const POOL_TAG = "Sv2/MARA🇺🇸🇺🇸//";
const MINER_TAG = "Sv2//Foundry USA Pool/";

test("a Stratum V2 block is its pool field's pool, never its miner field's", async ({
  page,
  mine,
}) => {
  // Mines first through the fixture, so this fails clearly anywhere but the `mines` project.
  await mine(1);
  const [pool, miner] = JSON.parse(
    execFileSync("python3", [REGTEST, "tagged", "--extranonce", "20", POOL_TAG, MINER_TAG], {
      encoding: "utf8",
    }),
  ) as { block: string }[];
  if (pool === undefined || miner === undefined) throw new Error("the harness made two blocks");

  await page.goto(`/regtest/block/${pool.block}`);
  const tag = page.getByRole("definition").filter({ hasText: "Written by the miner" });
  await expect(tag).toContainText(POOL_TAG);
  const named = page.getByRole("definition").filter({ hasText: "By payout address or tag" });
  await expect(named.getByRole("link")).toHaveText("MARA Pool");
  await expect(named.getByRole("link")).toHaveAttribute("href", "/regtest/mining/pool/marapool");

  await page.goto(`/regtest/block/${miner.block}`);
  await expect(tag).toContainText(MINER_TAG);
  const unnamed = page.getByRole("definition").filter({ hasText: "No listed address or tag" });
  await expect(unnamed.getByRole("link")).toHaveText("Unknown");
});
