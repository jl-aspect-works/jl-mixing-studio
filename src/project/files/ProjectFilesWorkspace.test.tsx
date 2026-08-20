import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectFilesWorkspace } from "./ProjectFilesWorkspace";

const { browserProps } = vi.hoisted(() => ({ browserProps: vi.fn() }));

type BrowserProps = {
  initialPath: string;
  rootPath?: string;
  enhancedNavigation?: boolean;
  breadcrumbRootLabel?: string;
  pathDescription?: (relativePath: string) => string;
};

vi.mock("./ProjectFileBrowser", () => ({
  ProjectFileBrowser: (props: BrowserProps) => {
    browserProps(props);
    return <div data-testid="project-file-browser">{props.initialPath || "Project root"}</div>;
  },
}));

afterEach(cleanup);

describe("ProjectFilesWorkspace", () => {
  beforeEach(() => {
    browserProps.mockClear();
  });

  it("opens as a full-width project-root browser without the legacy project tree", () => {
    render(<ProjectFilesWorkspace clientId="client-1" projectId="project-1" />);

    expect(screen.getByRole("heading", { name: "Project files" })).toBeInTheDocument();
    expect(screen.queryByText("Project structure", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByTestId("project-file-browser")).toHaveTextContent("Project root");

    const props = browserProps.mock.calls[browserProps.mock.calls.length - 1]?.[0] as BrowserProps;
    expect(props.initialPath).toBe("");
    expect(props.rootPath).toBe("");
    expect(props.enhancedNavigation).toBe(true);
    expect(props.breadcrumbRootLabel).toBe("Project root");
  });

  it("preserves contextual managed-area policy messaging for the browser path", () => {
    render(<ProjectFilesWorkspace clientId="client-1" projectId="project-1" />);

    const props = browserProps.mock.calls[browserProps.mock.calls.length - 1]?.[0] as BrowserProps;
    expect(props.pathDescription?.("01_Client_Files/Original_Delivery")).toMatch(/Original Delivery is read-only/);
    expect(props.pathDescription?.("02_Audio_Preparation/Working_Audio")).toMatch(/Audio Preparation is a working area/);
    expect(props.pathDescription?.("04_Revisions/Rev_02")).toMatch(/Revision files are managed project assets/);
    expect(props.pathDescription?.("05_Final_Delivery")).toMatch(/Final Delivery is managed by the Delivery workflow/);
  });
});
