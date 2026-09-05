import { invoke } from "@tauri-apps/api/core";
import type { ComparisonDocument, ComparisonSetupData, ProjectRegion } from "./models";

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
