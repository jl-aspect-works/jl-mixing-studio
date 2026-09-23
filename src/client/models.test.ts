import { describe, expect, it } from "vitest";
import { deriveClientId } from "./models";

describe("deriveClientId", () => {
  it.each([
    ["Acme Records", "acme-records"],
    ["  Café & Sons, LLC  ", "cafe-sons-llc"],
    ["O'Connor Audio", "o-connor-audio"],
    ["Mix---Room  12", "mix-room-12"],
  ])("normalizes %j to %j", (clientName, expected) => {
    expect(deriveClientId(clientName)).toBe(expected);
  });

  it("returns an empty ID when the name has no ASCII letters or numbers", () => {
    expect(deriveClientId("🎚️ 東京")).toBe("");
  });
});
