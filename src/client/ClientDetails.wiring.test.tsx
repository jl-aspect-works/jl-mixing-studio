import { describe, expect, it } from "vitest";
import { ClientDetails as RoutedClientDetails } from "../AppViews";
import { ClientDetails as ClientDetailsV21 } from "./ClientDetailsV21";

describe("Client Details route wiring", () => {
  it("exports the v2.1 Client Details implementation through the app view barrel", () => {
    expect(RoutedClientDetails).toBe(ClientDetailsV21);
  });
});
