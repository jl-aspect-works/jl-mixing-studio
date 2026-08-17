import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedFolderToolbar } from "./FileUiPrimitives";

afterEach(cleanup);

describe("managed folder button hierarchy", () => {
  it("keeps folder navigation and refresh actions secondary", () => {
    render(<ManagedFolderToolbar
      path="04_Revisions/Revision_01"
      canNavigateUp
      loading={false}
      onUp={vi.fn()}
      onRefresh={vi.fn()}
      onOpenFolder={vi.fn()}
    />);

    expect(screen.getByRole("button", { name: "Open Folder" })).toHaveClass("secondary");
    expect(screen.getByRole("button", { name: "Up" })).toHaveClass("secondary");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveClass("secondary");
  });
});
