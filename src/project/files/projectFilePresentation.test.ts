import { describe, expect, it } from "vitest";
import { presentProjectFileListing } from "./projectFilePresentation";
import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";

const entry = (overrides: Partial<ProjectFileEntry>): ProjectFileEntry => ({
  id: "file",
  relativePath: "file",
  displayName: "file",
  extension: null,
  entryType: "file",
  area: "otherManaged",
  sizeBytes: null,
  modifiedEpochMs: null,
  isAudio: false,
  playable: false,
  permissions: {
    canOpen: true,
    canReveal: true,
    canRename: false,
    canDelete: false,
    canCopy: false,
  },
  ...overrides,
});

const listing = (): ProjectFileListing => ({
  relativePath: "",
  area: "projectRoot",
  permissions: {
    canOpen: true,
    canReveal: true,
    canRename: false,
    canDelete: false,
    canCopy: false,
  },
  entries: [
    entry({ id: "folder", relativePath: "Folder", displayName: "Folder", entryType: "directory" }),
    entry({ id: "mix-b", relativePath: "Mix B.wav", displayName: "Mix B.wav", extension: "wav", isAudio: true, sizeBytes: 300, modifiedEpochMs: 200 }),
    entry({ id: "notes", relativePath: "Notes.md", displayName: "Notes.md", extension: "md", sizeBytes: 100, modifiedEpochMs: 300 }),
    entry({ id: "mix-a", relativePath: "Mix A.wav", displayName: "Mix A.wav", extension: "wav", isAudio: true, sizeBytes: 200, modifiedEpochMs: 100 }),
  ],
});

describe("project file presentation", () => {
  it("searches case-insensitively without mutating the source listing", () => {
    const source = listing();
    const result = presentProjectFileListing(source, { query: "mix" });
    expect(result.entries.map((item) => item.displayName)).toEqual(["Mix A.wav", "Mix B.wav"]);
    expect(source.entries).toHaveLength(4);
  });

  it("filters by shared file kinds", () => {
    expect(presentProjectFileListing(listing(), { kind: "audio" }).entries).toHaveLength(2);
    expect(presentProjectFileListing(listing(), { kind: "folders" }).entries.map((item) => item.displayName)).toEqual(["Folder"]);
    expect(presentProjectFileListing(listing(), { kind: "files" }).entries).toHaveLength(3);
  });

  it("keeps folders first while sorting files by modified time or size", () => {
    expect(presentProjectFileListing(listing(), { sort: "modified" }).entries.map((item) => item.displayName)).toEqual([
      "Folder",
      "Notes.md",
      "Mix B.wav",
      "Mix A.wav",
    ]);
    expect(presentProjectFileListing(listing(), { sort: "size" }).entries.map((item) => item.displayName)).toEqual([
      "Folder",
      "Mix B.wav",
      "Mix A.wav",
      "Notes.md",
    ]);
  });
});
