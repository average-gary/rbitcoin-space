// MOCKUP, never merged: the redesigned transaction page, on recorded sample data.
import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

export const routes: RouteDefinition[] = [
  { path: "/mock/tx", component: lazy(() => import("./MockTx")) },
];
