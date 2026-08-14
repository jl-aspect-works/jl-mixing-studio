import { describe, expect, it } from "vitest";
import {
  formatProjectFileModified,
  formatProjectFileSize,
  projectFilePaths,
} from "./projectFileService";

describe("projectFileService", () => {
  it("uses the authoritative Automation project paths", () => {
    expect(projectFilePaths.originalDelivery).toBe("01_Client_Files/Original_Delivery");
    expect(projectFilePaths.references).toBe("01_Client_Files/References");
    expect(projectFilePaths.audioPreparationWorking).toBe("02_Audio_Preparation/Working_Audio");
    expect(projectFilePaths.revisions).toBe("04_Revisions");
    expect(projectFilePaths.finalDelivery).toBe("05_Final_Delivery");
  });

  it("formats normalized file sizes", () => {
    expect(formatProjectFileSize(null)).toBe("—");
    expect(formatProjectFileSize(512)).toBe("512 B");
    expect(formatProjectFileSize(1024)).toBe("1.0 KB");
    expect(formatProjectFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("handles missing modified timestamps", () => {
    expect(formatProjectFileModified(null)).toBe("—");
  });
});
