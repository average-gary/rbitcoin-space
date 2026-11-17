// MOCKUP, never merged: the redesigned mempool history page, on recorded sample data.
import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

export const routes: RouteDefinition[] = [
  { path: "/mock/mempool-history", component: lazy(() => import("./MockMempoolHistory")) },
];
