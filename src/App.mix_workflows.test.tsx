import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockedInvoke, version, revisionPreviewResult, revisionCreateResult, deliveryPreviewResult, deliveryCreateResult, approvalPreviewResult, approvalResult, intakeNotRun, healthyWorkspace, respondWith, resetAppTestState, deliveryStatusForProject } from "./App.testSupport";
import App from "./App";
import type { ApprovalOperationResult, DeliveryOperationResult, RevisionOperationResult } from "./types";

afterEach(cleanup);

describe("JL Mixing Studio — revision, approval, and delivery workflows", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("opens authoritative revision history and selects an older approved revision", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));

      expect(screen.getByRole("heading", { name: "Revision History" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New Revision" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Approve Revision" })).toBeEnabled();
      expect(screen.getByRole("heading", { name: "Revision 02" })).toBeInTheDocument();
      expect(screen.getAllByText("Balance update").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Current").length).toBeGreaterThan(0);

      fireEvent.click(within(screen.getByRole("navigation", { name: "Revision history" })).getByRole("button", { name: /Revision 01/ }));

      expect(screen.getByRole("heading", { name: "Revision 01" })).toBeInTheDocument();
      expect(screen.getAllByText("Initial mix").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Approve Revision" })).toBeDisabled();
    });

  it("keeps revision history readable in a partial workspace", async () => {
      const partial = healthyWorkspace();
      partial.status = "partial";
      partial.counts.issues = 1;
      partial.issues = [{ scope: "project", code: "invalidJson", displayName: "Other Project", relativePath: "other.json", message: "Invalid JSON", recovery: "Repair it." }];
      respondWith(partial);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));

      expect(screen.getByRole("heading", { name: "Revision History" })).toBeInTheDocument();
      expect(screen.getAllByText("Balance update").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "New Revision" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Approve Revision" })).toBeDisabled();
    });

  it("shows authoritative first-delivery readiness with guided creation available", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      expect(screen.getByRole("heading", { name: "Delivery", level: 2 })).toBeInTheDocument();
      expect(screen.getByText("Ready for first delivery")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Delivery" })).toBeEnabled();
      expect(screen.getAllByText("No generated ZIP").length).toBeGreaterThan(0);
    });

  it("shows the fixed approved-revision package plan and cancels without creating", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(deliveryStatusForProject(healthyWorkspace().clients[0].projects[0]));
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Create Delivery" }));

      const dialog = await screen.findByRole("dialog", { name: "Build Package" });
      expect(within(dialog).getByText(/Approved Revision 01/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Delivery Notes are included automatically/i)).toBeInTheDocument();
      expect(within(dialog).queryByRole("checkbox", { name: /Clean delivery first/i })).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Build Package" })).not.toBeInTheDocument();
      expect(mockedInvoke.mock.calls.some(([command]) => command === "preflight_delivery_creation")).toBe(false);
      expect(mockedInvoke.mock.calls.some(([command]) => command === "create_delivery")).toBe(false);
    });

  it("displays authoritative managed deliverables and package state", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      respondWith(workspace);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      expect(await screen.findByText("Delivery files are verified")).toBeInTheDocument();
      expect(screen.getByText("Blue Sky Main Mix.wav")).toBeInTheDocument();
      expect(screen.getByText("Main Mix")).toBeInTheDocument();
      expect(screen.getByText("1.17 KB")).toBeInTheDocument();
      expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Rebuild Package" })).toBeEnabled();
      expect(screen.getAllByText("No generated ZIP").length).toBeGreaterThan(0);
    });

  it("edits and verifies the fixed Delivery Notes document", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      mockedInvoke.mockImplementation((command, args) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(deliveryStatusForProject(project));
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "# Delivery\n\nOriginal notes.\n", maxBytes: 65536 });
        if (command === "update_delivery_notes") {
          const request = (args as { request: { content: string } }).request;
          return Promise.resolve({ content: request.content, maxBytes: 65536 });
        }
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const editor = await screen.findByRole("textbox", { name: "Delivery Notes Markdown content" });
      fireEvent.change(editor, { target: { value: "# Delivery\n\nUpdated handoff.\n" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Delivery Notes" }));

      expect(await screen.findByText("Delivery Notes saved.")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("update_delivery_notes", {
        request: { clientId: "acme", projectId: "blue-sky", content: "# Delivery\n\nUpdated handoff.\n" },
      });
    });

  it("adds another package without deleting existing generated ZIPs by default", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: deliveryPreviewResult.delivery!.selected.map((file, index) => ({ path: file.path, deliverableType: file.deliverableType, sizeBytes: 1200 + index, sha256: String(index).repeat(64) })),
      };
      const preview: DeliveryOperationResult = { ...deliveryPreviewResult, delivery: { ...deliveryPreviewResult.delivery!, deliveredRevision: 1, replacementMode: "overwrite", createZip: true } };
      const created: DeliveryOperationResult = { ...preview, code: "created", message: "Delivery package created successfully.", delivery: { ...preview.delivery!, zipName: "blue-sky-rev-01-20260724153045.zip" } };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(deliveryStatusForProject(project));
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "Edited notes\n", maxBytes: 65536 });
        if (command === "preflight_delivery_creation") return Promise.resolve(preview);
        if (command === "create_delivery") return Promise.resolve(created);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Rebuild Package" }));

      const dialog = await screen.findByRole("dialog", { name: "Build Package" });
      expect(within(dialog).getByRole("checkbox", { name: /Clean delivery first/i })).not.toBeChecked();
      expect(within(dialog).getByText(/Delivery Notes are included automatically/i)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Build Package" }));

      expect(await screen.findByText(/Package built from Revision 1 with 2 verified delivered files/)).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_delivery_creation", {
        request: { clientId: "acme", projectId: "blue-sky", replacementMode: "overwrite", createZip: true, confirmedDeletions: [] },
      });
      expect(mockedInvoke.mock.calls.some(([command]) => command === "delete_delivery_package")).toBe(false);
    });

  it("cleans only generated ZIPs before building when requested", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: deliveryPreviewResult.delivery!.selected.map((file, index) => ({ path: file.path, deliverableType: file.deliverableType, sizeBytes: 1200 + index, sha256: String(index).repeat(64) })),
      };
      const preview: DeliveryOperationResult = { ...deliveryPreviewResult, delivery: { ...deliveryPreviewResult.delivery!, deliveredRevision: 1, replacementMode: "overwrite", createZip: true } };
      const created: DeliveryOperationResult = { ...preview, code: "created", message: "Delivery package created successfully.", delivery: { ...preview.delivery!, zipName: "blue-sky-rev-01-20260724153045.zip" } };
      const managed = deliveryStatusForProject(project);
      managed.delivery!.packages = [
        { name: "blue-sky-rev-01-20260724120000.zip", path: "/workspace/Clients/acme/Projects/blue-sky/05_Final_Delivery/blue-sky-rev-01-20260724120000.zip", status: "current", sizeBytes: 3200, modifiedAt: "2026-07-24T12:00:00Z", issues: [] },
        { name: "blue-sky-rev-01-20260724130000.zip", path: "/workspace/Clients/acme/Projects/blue-sky/05_Final_Delivery/blue-sky-rev-01-20260724130000.zip", status: "current", sizeBytes: 3300, modifiedAt: "2026-07-24T13:00:00Z", issues: [] },
      ];
      managed.delivery!.currentPackage = managed.delivery!.packages[1];
      managed.delivery!.packageState = "current";
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(managed);
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "Edited notes\n", maxBytes: 65536 });
        if (command === "preflight_delivery_creation") return Promise.resolve(preview);
        if (command === "delete_delivery_package") return Promise.resolve(managed);
        if (command === "create_delivery") return Promise.resolve(created);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Rebuild Package" }));

      const dialog = await screen.findByRole("dialog", { name: "Build Package" });
      fireEvent.click(within(dialog).getByRole("checkbox", { name: /Clean delivery first/i }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Build Package" }));

      expect(await screen.findByText(/Package built from Revision 1 with 2 verified delivered files/)).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "delete_delivery_package")).toHaveLength(2);
      expect(mockedInvoke).toHaveBeenCalledWith("delete_delivery_package", {
        request: { clientId: "acme", projectId: "blue-sky", zipName: "blue-sky-rev-01-20260724120000.zip" },
      });
      expect(mockedInvoke).toHaveBeenCalledWith("delete_delivery_package", {
        request: { clientId: "acme", projectId: "blue-sky", zipName: "blue-sky-rev-01-20260724130000.zip" },
      });
      expect(mockedInvoke).toHaveBeenCalledWith("create_delivery", {
        request: { clientId: "acme", projectId: "blue-sky", replacementMode: "overwrite", createZip: true, confirmedDeletions: [] },
      });
    });

  it("creates the first package and refreshes the authoritative delivery", async () => {
      const before = healthyWorkspace();
      const after = healthyWorkspace();
      const project = after.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [
          { path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) },
          { path: "Stems/Blue Sky Stems.wav", deliverableType: "stems", sizeBytes: 2400, sha256: "1".repeat(64) },
        ],
      };
      let discoveries = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(discoveries++ === 0 ? before : after);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(deliveryStatusForProject(discoveries > 1 ? project : before.clients[0].projects[0]));
        if (command === "preflight_delivery_creation") return Promise.resolve(deliveryPreviewResult);
        if (command === "create_delivery") return Promise.resolve(deliveryCreateResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Create Delivery" }));
      const dialog = await screen.findByRole("dialog", { name: "Build Package" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Build Package" }));

      expect(await screen.findByText(/Package built from Revision 1 with 2 verified delivered files/)).toBeInTheDocument();
      expect(await screen.findByText("Delivery files are verified")).toBeInTheDocument();
      expect(screen.getByText("Stems/Blue Sky Stems.wav")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_delivery_creation", {
        request: { clientId: "acme", projectId: "blue-sky", replacementMode: "default", createZip: true, confirmedDeletions: [] },
      });
    });

  it("blocks package creation when preflight no longer matches the approved revision", async () => {
      const mismatched: DeliveryOperationResult = {
        ...deliveryPreviewResult,
        delivery: { ...deliveryPreviewResult.delivery!, approvedRevision: 2, createZip: true },
      };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "get_delivery_status") return Promise.resolve(deliveryStatusForProject(healthyWorkspace().clients[0].projects[0]));
        if (command === "preflight_delivery_creation") return Promise.resolve(mismatched);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Create Delivery" }));
      const dialog = await screen.findByRole("dialog", { name: "Build Package" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Build Package" }));

      expect(await screen.findByText(/package preview no longer matches the approved revision/i)).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.some(([command]) => command === "create_delivery")).toBe(false);
    });

  it("identifies an existing delivery built from an older approved revision", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.approvedRevision = 2;
      project.revisions[1].approvedAt = "2026-07-18T12:00:00Z";
      project.revisions[1].approvedBy = "Client";
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065", createdWith: "jl-mixing 1.2.0", createdAt: "2026-07-18T13:00:00Z", method: "Download", revision: 1,
        revisionId: project.revisions[0].revisionId, description: project.revisions[0].description, approvedAt: project.revisions[0].approvedAt!, approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      respondWith(workspace);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      expect(await screen.findByText("Delivery needs attention")).toBeInTheDocument();
      expect(screen.getByText(/built from Revision 01.*Revision 02 is approved/i)).toBeInTheDocument();
    });

  it("preflights a trimmed revision description and cancels without creating", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "New Revision" }));

      expect(screen.getByRole("heading", { name: "New revision" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /^Revision description/ })).toHaveFocus();
      fireEvent.change(screen.getByRole("textbox", { name: /^Revision description/ }), { target: { value: " Vocal lift " } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));

      expect(await screen.findByRole("heading", { name: "Confirm new revision" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Revision 3")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_revision_creation", {
        request: { clientId: "acme", projectId: "blue-sky", description: "Vocal lift" },
      });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockedInvoke).not.toHaveBeenCalledWith("create_revision", expect.anything());
    });

  it("creates, refreshes, and selects the verified authoritative revision", async () => {
      let workspaceCalls = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") {
          workspaceCalls += 1;
          const snapshot = healthyWorkspace();
          if (workspaceCalls > 1) {
            const project = snapshot.clients[0].projects[0];
            project.currentRevision = 3;
            project.revisions.push({
              number: 3,
              revisionId: "dd0cb190-bd55-4200-bca0-b5472cbef368",
              createdAt: "2026-07-18T12:00:00Z",
              description: "Vocal lift",
              approvedAt: null,
              approvedBy: null,
            });
          }
          return Promise.resolve(snapshot);
        }
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        if (command === "create_revision") return Promise.resolve(revisionCreateResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "New Revision" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Revision description/ }), { target: { value: "Vocal lift" } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));
      await screen.findByRole("heading", { name: "Confirm new revision" });
      fireEvent.click(screen.getByRole("button", { name: "Create revision" }));

      expect(await screen.findByText("Revision 3 was created and verified.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Revision History" })).toBeInTheDocument();
      expect(within(screen.getByRole("navigation", { name: "Revision history" })).getByRole("button", { name: /Revision 03 Current Vocal lift/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Revision 02" })).toBeInTheDocument();
      expect(screen.getAllByText("Vocal lift").length).toBeGreaterThan(0);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_revision")).toHaveLength(1);
    });

  it("does not retry an uncertain revision-creation result", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        if (command === "create_revision") return Promise.resolve({
          ok: false,
          code: "uncertain",
          message: "The operation may have completed; do not retry automatically.",
          revision: null,
        } satisfies RevisionOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "New Revision" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Revision description/ }), { target: { value: "Vocal lift" } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));
      await screen.findByRole("heading", { name: "Confirm new revision" });
      fireEvent.click(screen.getByRole("button", { name: "Create revision" }));

      expect(await screen.findByRole("heading", { name: "Creation needs verification" })).toBeInTheDocument();
      expect(screen.getByText(/do not retry automatically/i)).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_revision")).toHaveLength(1);
    });

  it("preflights approval for the selected revision and cancels without approving", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve Revision" }));

      expect(screen.getByRole("heading", { name: "Approve Revision 2" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: /approved by/i })).toHaveValue("Client");
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));

      expect(await screen.findByRole("heading", { name: "Confirm revision approval" })).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_revision_approval", {
        request: { clientId: "acme", projectId: "blue-sky", revision: 2, approvedBy: "Client" },
      });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockedInvoke).not.toHaveBeenCalledWith("approve_revision", expect.anything());
    });

  it("approves, refreshes, and verifies the authoritative selected revision", async () => {
      let workspaceCalls = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") {
          workspaceCalls += 1;
          const snapshot = healthyWorkspace();
          if (workspaceCalls > 1) {
            const project = snapshot.clients[0].projects[0];
            project.approvedRevision = 2;
            project.revisions[1].approvedBy = "Client";
            project.revisions[1].approvedAt = "2026-07-18T13:00:00Z";
          }
          return Promise.resolve(snapshot);
        }
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        if (command === "approve_revision") return Promise.resolve(approvalResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve Revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));
      await screen.findByRole("heading", { name: "Confirm revision approval" });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve revision" }));

      expect(await screen.findByText("Revision 2 was approved by Client and verified.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Approve Revision" })).toBeDisabled();
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "approve_revision")).toHaveLength(1);
    });

  it("warns before replacing historical approval on an older revision", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.approvedRevision = 2;
      project.revisions[1].approvedAt = "2026-07-17T18:00:00Z";
      project.revisions[1].approvedBy = "Current Reviewer";
      const historicalPreview: ApprovalOperationResult = {
        ...approvalPreviewResult,
        approval: { ...approvalPreviewResult.approval!, revision: 1 },
      };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(historicalPreview);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(within(screen.getByRole("navigation", { name: "Revision history" })).getByRole("button", { name: /Revision 01/ }));
      fireEvent.click(screen.getByRole("button", { name: "Approve Revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));

      const warning = await screen.findByText("Check what will change");
      expect(warning.parentElement).toHaveTextContent(/existing approval record.*older than current Revision 2/i);
    });

  it("does not retry an uncertain revision-approval result", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        if (command === "approve_revision") return Promise.resolve({
          ok: false,
          code: "uncertain",
          message: "The operation may have completed; do not retry automatically.",
          approval: null,
        } satisfies ApprovalOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve Revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));
      await screen.findByRole("heading", { name: "Confirm revision approval" });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve revision" }));

      expect(await screen.findByRole("heading", { name: "Approval needs verification" })).toBeInTheDocument();
      expect(screen.getByText(/do not retry automatically/i)).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "approve_revision")).toHaveLength(1);
    });
});