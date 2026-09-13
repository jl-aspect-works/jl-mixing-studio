import { invoke } from "@tauri-apps/api/core";
import type {
  ComparisonDocument,
  ComparisonLoudnessResult,
  ComparisonSetupData,
  ProjectRegion,
} from "./models";

type ProjectIdentity = { clientId: string; projectId: string };
type RegionValues = ProjectIdentity & { name: string; startSeconds: number; endSeconds: number };

type StoredRegion = {
  region_id: string;
  name: string;
  start_seconds: number;
  end_seconds: number | null;
  built_in: boolean;
};

type StoredDocument = {
  schema_version: number;
  regions: StoredRegion[];
  completed_sessions: unknown[];
};

type StoredSetup = Omit<ComparisonSetupData, "document"> & { document: StoredDocument };
type StoredLoudnessCandidate = {
  revision_id: string;
  revision_number: number;
  relative_path: string;
  integrated_lufs: number;
  applied_gain_db: number;
  cache_state: "analyzed" | "reused";
};
type StoredLoudnessResult = { candidates: StoredLoudnessCandidate[] };

const projectRegion = (region: StoredRegion): ProjectRegion => ({
  regionId: region.region_id,
  name: region.name,
  startSeconds: region.start_seconds,
  endSeconds: region.end_seconds,
  builtIn: region.built_in,
});

const comparisonDocument = (document: StoredDocument): ComparisonDocument => ({
  schemaVersion: document.schema_version,
  regions: document.regions.map(projectRegion),
  completedSessions: document.completed_sessions,
});

export const getComparisonSetup = (request: ProjectIdentity) =>
  invoke<StoredSetup>("get_comparison_setup", { request })
    .then((setup): ComparisonSetupData => ({ ...setup, document: comparisonDocument(setup.document) }));

export const addComparisonRegion = (request: RegionValues) =>
  invoke<StoredRegion>("add_comparison_region", { request }).then(projectRegion);

export const updateComparisonRegion = (request: RegionValues & { regionId: string }) =>
  invoke<StoredRegion>("update_comparison_region", { request }).then(projectRegion);

export const deleteComparisonRegion = (request: ProjectIdentity & { regionId: string }) =>
  invoke<StoredDocument>("delete_comparison_region", { request }).then(comparisonDocument);

export const analyzeComparisonLoudness = (
  request: ProjectIdentity & { candidates: { revisionId: string; revisionNumber: number; relativePath: string }[] },
) =>
  invoke<StoredLoudnessResult>("analyze_comparison_loudness", { request }).then((result): ComparisonLoudnessResult => ({
    candidates: result.candidates.map((candidate) => ({
      revisionId: candidate.revision_id,
      revisionNumber: candidate.revision_number,
      relativePath: candidate.relative_path,
      integratedLufs: candidate.integrated_lufs,
      appliedGainDb: candidate.applied_gain_db,
      cacheState: candidate.cache_state,
    })),
  }));
