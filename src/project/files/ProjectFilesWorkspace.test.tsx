import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectFilesWorkspace } from "./ProjectFilesWorkspace";

const { browserProps } = vi.hoisted(() => ({ browserProps: vi.fn() }));

vi.mock("./ProjectFileBrowser", () => ({
  ProjectFileBrowser: (props: { initialPath: string }) => {
    browserProps(props);
    return <div data-testid="project-file-browser">{props.initialPath || "Project root"}</div>;
  },
}));

afterEach(cleanup);

describe("ProjectFilesWorkspace", () => {
  beforeEach(() => {
    browserProps.mockClear();
  });

  it("starts at the project root and exposes the managed project structure", () => {
    render(<ProjectFilesWorkspace clientId="client-1" projectId="project-1" />);

    expect(screen.getByRole("button", { name: "Project root" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "01_Client_Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Original_Delivery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "02_Audio_Preparation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "04_Revisions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "05_Final_Delivery" })).toBeInTheDocument();
    expect(screen.getByTestId("project-file-browser")).toHaveTextContent("Project root");
  });

  it("selects a managed folder and updates the browser path and policy", () => {
    render(<ProjectFilesWorkspace clientId="client-1" projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Original_Delivery" }));

    expect(screen.getByRole("button", { name: "Original_Delivery" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "01_Client_Files/Original_Delivery" })).toBeInTheDocument();
    expect(screen.getByText(/Original Delivery is read-only/)).toBeInTheDocument();
    expect(screen.getByTestId("project-file-browser")).toHaveTextContent("01_Client_Files/Original_Delivery");
  });

  it("supports collapsing managed tree groups", () => {
    render(<ProjectFilesWorkspace clientId="client-1" projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse 01_Client_Files" }));

    expect(screen.queryByRole("button", { name: "Original_Delivery" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand 01_Client_Files" })).toBeInTheDocument();
  });
});
