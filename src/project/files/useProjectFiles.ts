import { useCallback, useEffect, useRef, useState } from "react";
import { addWorkspaceRefreshListener } from "../../app/workspaceRefreshEvents";
import {
  listProjectFiles,
  type ProjectFileListing,
} from "./projectFileService";

export type ProjectFilesState =
  | { status: "loading"; listing: ProjectFileListing | null; message: null }
  | { status: "ready"; listing: ProjectFileListing; message: null }
  | { status: "error"; listing: ProjectFileListing | null; message: string };

const listingCache = new Map<string, ProjectFileListing>();

const listingCacheKey = (clientId: string, projectId: string, relativePath: string) =>
  `${clientId}\u0000${projectId}\u0000${relativePath}`;

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
  const cacheKey = listingCacheKey(clientId, projectId, relativePath);
  const [state, setState] = useState<ProjectFilesState>(() => {
    const cached = listingCache.get(cacheKey);
    return cached
      ? { status: "ready", listing: cached, message: null }
      : { status: "loading", listing: null, message: null };
  });
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const cached = listingCache.get(cacheKey) ?? null;
    setState((current) => ({ status: "loading", listing: current.listing ?? cached, message: null }));
    try {
      const listing = await listProjectFiles({ clientId, projectId, relativePath });
      if (requestSequence.current !== sequence) return;
      listingCache.set(cacheKey, listing);
      setState({ status: "ready", listing, message: null });
    } catch (error) {
      if (requestSequence.current !== sequence) return;
      setState((current) => ({
        status: "error",
        listing: current.listing ?? cached,
        message: errorMessage(error),
      }));
    }
  }, [cacheKey, clientId, projectId, relativePath]);

  useEffect(() => {
    const cached = listingCache.get(cacheKey) ?? null;
    setState(cached
      ? { status: "ready", listing: cached, message: null }
      : { status: "loading", listing: null, message: null });
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [cacheKey, refresh]);

  useEffect(() => addWorkspaceRefreshListener(() => { void refresh(); }), [refresh]);

  return { state, refresh };
}
