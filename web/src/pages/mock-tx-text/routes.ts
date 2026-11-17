// MOCKUP, never merged: chain text on the transaction page, on recorded sample data.
import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

export const routes: RouteDefinition[] = [
  { path: "/mock/tx-text", component: lazy(() => import("./MockTxText")) },
];
