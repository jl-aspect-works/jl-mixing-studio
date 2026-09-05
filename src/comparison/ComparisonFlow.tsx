import { useState } from "react";
import type { ClientSummary, ProjectSummary } from "../types";
import type { FrozenComparisonSession } from "./models";
import { ComparisonSetup } from "./ComparisonSetup";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import "./ComparisonFlow.css";

export function ComparisonFlow({
  client,
  project,
  onClose,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  onClose: () => void;
}) {
  const [session, setSession] = useState<FrozenComparisonSession | null>(null);
  if (session) return <ComparisonWorkspace session={session} onCancel={onClose} />;
  return <ComparisonSetup client={client} project={project} onCancel={onClose} onStart={setSession} />;
}
