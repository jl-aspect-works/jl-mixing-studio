import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";

export type ProjectFileKindFilter = "all" | "audio" | "files" | "folders";
export type ProjectFileSort = "name" | "modified" | "size";

const matchesKind = (entry: ProjectFileEntry, kind: ProjectFileKindFilter) => {
  if (kind === "all") return true;
  if (kind === "audio") return entry.entryType === "file" && entry.isAudio;
  if (kind === "files") return entry.entryType === "file";
  return entry.entryType === "directory";
};

const compareNullableNumber = (left: number | null, right: number | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

const compareEntries = (left: ProjectFileEntry, right: ProjectFileEntry, sort: ProjectFileSort) => {
  const leftDirectory = left.entryType === "directory";
  const rightDirectory = right.entryType === "directory";
  if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;

  if (sort === "modified") {
    const modified = compareNullableNumber(left.modifiedEpochMs, right.modifiedEpochMs);
    if (modified !== 0) return modified;
  }
  if (sort === "size") {
    const size = compareNullableNumber(left.sizeBytes, right.sizeBytes);
    if (size !== 0) return size;
  }

  return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" });
};

export function presentProjectFileListing(
  listing: ProjectFileListing,
  { query = "", kind = "all", sort = "name" }: {
    query?: string;
    kind?: ProjectFileKindFilter;
    sort?: ProjectFileSort;
  } = {},
): ProjectFileListing {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = listing.entries
    .filter((entry) => matchesKind(entry, kind))
    .filter((entry) => normalizedQuery === "" || entry.displayName.toLocaleLowerCase().includes(normalizedQuery))
    .slice()
    .sort((left, right) => compareEntries(left, right, sort));

  return { ...listing, entries };
}
