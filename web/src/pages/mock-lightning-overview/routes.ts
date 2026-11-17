import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

// A design mockup on recorded data; never linked from the site.
export const routes: RouteDefinition[] = [
  { path: "/mock/lightning-overview", component: lazy(() => import("./MockOverview")) },
];
