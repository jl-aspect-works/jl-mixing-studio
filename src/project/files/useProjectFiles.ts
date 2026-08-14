import { useCallback, useEffect, useRef, useState } from "react";
import {
  listProjectFiles,
  type ProjectFileListing,
} from "./projectFileService";

export type ProjectFilesState =
  | { status: "loading"; listing: ProjectFileListing | null; message: null }
  | { status: "ready"; listing: ProjectFileListing; message: null }
  | { status: "error"; listing: ProjectFileListing | null; message: string };

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The project files could not be loaded.";

export function useProjectFiles({
  clientId,
  projectId,
  relativePath,
}: {
  clientId: string;
  projectId: string;
  relativePath: string;
}) {
  const [state, setState] = useState<ProjectFilesState>({
    status: "loading",
    listing: null,
    message: null,
  });
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setState((current) => ({ status: "loading", listing: current.listing, message: null }));
    try {
      const listing = await listProjectFiles({ clientId, projectId, relativePath });
      if (requestSequence.current !== sequence) return;
      setState({ status: "ready", listing, message: null });
    } catch (error) {
      if (requestSequence.current !== sequence) return;
      setState((current) => ({
        status: "error",
        listing: current.listing,
        message: errorMessage(error),
      }));
    }
  }, [clientId, projectId, relativePath]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  return { state, refresh };
}
