import { describe, expect, it } from "vitest";
import {
  canNavigateProjectFilesUp,
  projectFileParentPath,
  projectFilePathUp,
} from "./projectFileNavigation";

describe("project file navigation", () => {
  it("moves up within the assigned managed root", () => {
    const root = "02_Audio_Preparation";
    expect(canNavigateProjectFilesUp("02_Audio_Preparation/Working_Audio", root)).toBe(true);
    expect(projectFilePathUp("02_Audio_Preparation/Working_Audio", root)).toBe(root);
    expect(canNavigateProjectFilesUp(root, root)).toBe(false);
    expect(projectFilePathUp(root, root)).toBe(root);
  });

  it("does not treat a sibling prefix as part of the managed root", () => {
    const root = "01_Client_Files/References";
    expect(canNavigateProjectFilesUp("01_Client_Files/References-Archive", root)).toBe(false);
    expect(projectFilePathUp("01_Client_Files/References-Archive", root)).toBe(root);
  });

  it("supports project-root browsing without escaping the project", () => {
    expect(projectFileParentPath("04_Revisions/Revision_02")).toBe("04_Revisions");
    expect(projectFilePathUp("04_Revisions/Revision_02", "")).toBe("04_Revisions");
    expect(projectFilePathUp("04_Revisions", "")).toBe("");
    expect(canNavigateProjectFilesUp("", "")).toBe(false);
  });
});
