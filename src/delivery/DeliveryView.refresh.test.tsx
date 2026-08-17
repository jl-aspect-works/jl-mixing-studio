import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { healthyWorkspace, mockedInvoke } from "../App.testSupport";
import { notifyWorkspaceRefreshed } from "../app/workspaceRefreshEvents";
import type { DeliveryStatusResult, ManagedDeliveryStatus } from "./statusModels";
import { DeliveryView } from "./DeliveryView";

vi.mock("./DeliveryFilesList", () => ({
  DeliveryFilesList: () => <div data-testid="delivery-files" />,
}));

const project = {
  ...healthyWorkspace().clients[0].projects[0],
  currentRevision: 1,
  approvedRevision: 1,
  deliveredRevision: 1,
};

const managedDelivery: ManagedDeliveryStatus = {
  deliveryPath: "05_Final_Delivery",
  deliveryManifestPath: "05_Final_Delivery/delivery.json",
  state: "ready",
  revisions: { current: 1, approved: 1, delivered: 1, source: 1 },
  deliverables: [],
  deliverableCount: 0,
  untracked: [],
  issues: [],
  notes: {
    path: "05_Final_Delivery/Delivery_Notes.md",
    present: true,
    sizeBytes: 14,
    modifiedAt: "2026-08-16T12:00:00Z",
  },
  packages: [],
  packageState: "none",
  currentPackage: null,
};

const deliveryStatus = (): DeliveryStatusResult => ({
  ok: true,
  message: "Delivery status ready.",
  delivery: managedDelivery,
});

const renderView = () => render(<DeliveryView
  clientId="client-1"
  project={project}
  loading={false}
  actionError={null}
  creationAvailable
  creationHelp=""
  onProjects={vi.fn()}
  onOverview={vi.fn()}
  onCreate={vi.fn()}
  onRefresh={vi.fn()}
  onSelectView={vi.fn()}
/>);

beforeEach(() => {
  mockedInvoke.mockReset();
});

afterEach(cleanup);

describe("DeliveryView workspace refresh", () => {
  it("reloads clean Delivery Notes and delivery status after a successful workspace refresh", async () => {
    let notesCalls = 0;
    let statusCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "get_delivery_status") {
        statusCalls += 1;
        return Promise.resolve(deliveryStatus());
      }
      if (command === "get_delivery_notes") {
        notesCalls += 1;
        return Promise.resolve({
          content: notesCalls === 1 ? "Original notes" : "Externally updated notes",
          maxBytes: 65_536,
        });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    renderView();
    const editor = await screen.findByRole("textbox", { name: "Delivery Notes Markdown content" });
    await waitFor(() => expect(editor).toHaveValue("Original notes"));

    notifyWorkspaceRefreshed();

    await waitFor(() => expect(editor).toHaveValue("Externally updated notes"));
    expect(notesCalls).toBe(2);
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });

  it("does not overwrite unsaved local Delivery Notes during automatic refresh", async () => {
    let notesCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "get_delivery_status") return Promise.resolve(deliveryStatus());
      if (command === "get_delivery_notes") {
        notesCalls += 1;
        return Promise.resolve({ content: "Original notes", maxBytes: 65_536 });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    renderView();
    const editor = await screen.findByRole("textbox", { name: "Delivery Notes Markdown content" });
    await waitFor(() => expect(editor).toHaveValue("Original notes"));
    fireEvent.change(editor, { target: { value: "Unsaved local edit" } });

    notifyWorkspaceRefreshed();

    await waitFor(() => expect(editor).toHaveValue("Unsaved local edit"));
    expect(notesCalls).toBe(1);
  });
});
