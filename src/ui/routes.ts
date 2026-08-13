import { copy as productCopy } from "../resources/copy";

export type PrimaryRoute =
  | "dashboard"
  | "studio"
  | "clients"
  | "projects"
  | "tasks"
  | "reports"
  | "activity"
  | "settings";

export interface RouteDefinition {
  id: PrimaryRoute;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const routes: RouteDefinition[] = ([
  "dashboard",
  "studio",
  "clients",
  "projects",
  "tasks",
  "activity",
  "settings",
] as const).map((id) => ({
  id,
  ...productCopy.routes[id],
  label: id === "activity" ? "Activities" : productCopy.routes[id].label,
}));
