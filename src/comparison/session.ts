import type {
  ComparisonCandidateAvailability,
  FrozenComparisonCandidate,
  FrozenComparisonSession,
  ProjectRegion,
} from "./models";

export const MAX_SHORTCUT_CANDIDATES = 26;

export const parseTimestamp = (value: string): number | null => {
  const parts = value.trim().split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) {
    return null;
  }
  const values = parts.map(Number);
  if (values.some((part) => !Number.isFinite(part))) return null;
  if (values.length > 1 && values.slice(1).some((part) => part >= 60)) return null;
  return values.reduce((total, part) => total * 60 + part, 0);
};

export const formatTimestamp = (seconds: number): string => {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export type ComparisonTransportShortcut = "toggle" | "back" | "forward" | "previousCandidate" | "nextCandidate";

const shuffled = <T,>(items: readonly T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

const secureRandom = (): number => {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
};

export const freezeComparisonSession = (
  candidates: readonly (ComparisonCandidateAvailability & Partial<{ integratedLufs: number; appliedGainDb: number; regionLoudness: FrozenComparisonCandidate["regionLoudness"] }>)[],
  regions: readonly ProjectRegion[],
  loudnessMatch: boolean,
  random: () => number = secureRandom,
  regionLoudnessMatch = false,
): FrozenComparisonSession => {
  const randomized = shuffled(candidates, random).map((candidate, index) => Object.freeze({
    revisionId: candidate.revisionId,
    revisionNumber: candidate.revisionNumber,
    blindId: String.fromCharCode(65 + index),
    relativePath: candidate.relativePath!,
    integratedLufs: "integratedLufs" in candidate && typeof candidate.integratedLufs === "number" ? candidate.integratedLufs : null,
    appliedGainDb: "appliedGainDb" in candidate && typeof candidate.appliedGainDb === "number" ? candidate.appliedGainDb : null,
    regionLoudness: candidate.regionLoudness,
  }));
  return Object.freeze({
    candidates: Object.freeze(randomized),
    regions: Object.freeze(regions.map((region) => Object.freeze({ ...region }))),
    loudnessMatch,
    regionLoudnessMatch,
  });
};

const eventTargetAllowsShortcuts = (event: Pick<KeyboardEvent, "target" | "metaKey" | "ctrlKey" | "altKey">) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  return !(target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  ));
};

export const shortcutCandidate = (
  event: Pick<KeyboardEvent, "key" | "target" | "metaKey" | "ctrlKey" | "altKey">,
  candidates: readonly { blindId: string }[],
) => {
  if (!eventTargetAllowsShortcuts(event)) return null;
  const key = event.key.toUpperCase();
  return candidates.find((candidate) => candidate.blindId === key)?.blindId ?? null;
};

export const shortcutTransport = (
  event: Pick<KeyboardEvent, "key" | "code" | "target" | "metaKey" | "ctrlKey" | "altKey">,
): ComparisonTransportShortcut | null => {
  if (!eventTargetAllowsShortcuts(event)) return null;
  if (event.key === " " || event.key === "Spacebar" || event.code === "Space") return "toggle";
  if (event.key === ",") return "back";
  if (event.key === ".") return "forward";
  if (event.key === "ArrowLeft") return "previousCandidate";
  if (event.key === "ArrowRight") return "nextCandidate";
  return null;
};
