// MOCKUP, never merged: link preview cards in three directions, on recorded sample data.
import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

export const routes: RouteDefinition[] = [
  { path: "/mock/preview-cards", component: lazy(() => import("./MockPreviewCards")) },
];
