import type {
  ComparisonCandidateAvailability,
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
  candidates: readonly ComparisonCandidateAvailability[],
  regions: readonly ProjectRegion[],
  loudnessMatch: boolean,
  random: () => number = secureRandom,
): FrozenComparisonSession => {
  const randomized = shuffled(candidates, random).map((candidate, index) => Object.freeze({
    revisionId: candidate.revisionId,
    revisionNumber: candidate.revisionNumber,
    blindId: String.fromCharCode(65 + index),
  }));
  return Object.freeze({
    candidates: Object.freeze(randomized),
    regions: Object.freeze(regions.map((region) => Object.freeze({ ...region }))),
    loudnessMatch,
  });
};

export const shortcutCandidate = (
  event: Pick<KeyboardEvent, "key" | "target" | "metaKey" | "ctrlKey" | "altKey">,
  candidates: readonly { blindId: string }[],
) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  )) return null;
  const key = event.key.toUpperCase();
  return candidates.find((candidate) => candidate.blindId === key)?.blindId ?? null;
};
