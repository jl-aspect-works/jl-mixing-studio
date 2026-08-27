import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedImportProgress } from "./models";

const core = vi.hoisted(() => ({
  invoke: vi.fn(),
  channels: [] as Array<{ onmessage: (message: ManagedImportProgress) => void }>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: core.invoke,
  Channel: class<T> {
    onmessage: (message: T) => void = () => undefined;

    constructor() {
      core.channels.push(this as unknown as { onmessage: (message: ManagedImportProgress) => void });
    }
  },
}));

vi.mock("../project/files/audioPlaybackController", () => ({
  stopActiveAudioPlayback: vi.fn().mockResolvedValue(undefined),
}));

import { executeManagedImport } from "./managedClientFilesService";

describe("executeManagedImport", () => {
  beforeEach(() => {
    core.invoke.mockReset();
    core.channels.length = 0;
  });

  it("delivers per-invocation progress directly through the Tauri channel", async () => {
    const progress: ManagedImportProgress = {
      clientId: "client",
      projectId: "project",
      phase: "importing",
      completed: 4,
      total: 12,
      overallCompleted: 16,
      overallTotal: 25,
      active: ["Kick.wav"],
    };
    const onProgress = vi.fn();
    core.invoke.mockImplementation(async (command: string, args: { progress: { onmessage: (message: ManagedImportProgress) => void } }) => {
      expect(command).toBe("execute_managed_client_import");
      args.progress.onmessage(progress);
      return { ok: true, status: "success", message: "", data: {} };
    });

    await executeManagedImport({
      clientId: "client",
      projectId: "project",
      sourceKind: "files",
      sources: ["/incoming/Kick.wav"],
      planId: "plan",
    }, onProgress);

    expect(core.channels).toHaveLength(1);
    expect(onProgress).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledWith(progress);
  });
});
