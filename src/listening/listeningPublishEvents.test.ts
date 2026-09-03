import { describe, expect, it } from "vitest";

import {
  applyListeningPublishEvent,
  recordListeningPublishEvent,
  type ListeningActivitySnapshot,
  type ListeningPublishEvent,
} from "./listeningPublishEvents";

const failed: ListeningPublishEvent = {
  clientId: "client-a",
  projectId: "project-a",
  revision: 1,
  results: [{
    destinationId: "delivered-mp3",
    status: "failed",
    message: "Old failure",
    selectedSource: null,
    destinationPath: "/listening",
  }],
};

const published: ListeningPublishEvent = {
  ...failed,
  results: [{
    destinationId: "delivered-mp3",
    status: "published",
    message: "Published",
    selectedSource: "/delivery/mix.mp3",
    destinationPath: "/listening/client-a/project-a.mp3",
  }],
};

const quiet: ListeningPublishEvent = {
  clientId: "client-a",
  projectId: "project-a",
  revision: 1,
  results: [],
};

describe("Listening publish activity reconciliation", () => {
  it("clears a matching stale failure after a quiet successful reconciliation", () => {
    const snapshot: ListeningActivitySnapshot = {
      "delivered-listening-publish-results": failed,
    };

    expect(applyListeningPublishEvent(
      snapshot,
      "delivered-listening-publish-results",
      quiet,
    )).toEqual({});
  });

  it("preserves a prior published result during routine current-target reconciliation", () => {
    const snapshot: ListeningActivitySnapshot = {
      "delivered-listening-publish-results": published,
    };

    const next = applyListeningPublishEvent(
      snapshot,
      "delivered-listening-publish-results",
      quiet,
    );
    expect(next).toBe(snapshot);
  });

  it("does not clear a failure belonging to another project or revision", () => {
    const snapshot: ListeningActivitySnapshot = {
      "revision-listening-publish-results": failed,
    };
    const otherProjectQuiet = { ...quiet, projectId: "project-b" };

    expect(applyListeningPublishEvent(
      snapshot,
      "revision-listening-publish-results",
      otherProjectQuiet,
    )).toEqual(snapshot);
  });

  it("records a new non-empty result normally", () => {
    const snapshot: ListeningActivitySnapshot = {
      "delivered-listening-publish-results": failed,
    };

    expect(applyListeningPublishEvent(
      snapshot,
      "delivered-listening-publish-results",
      published,
    )).toEqual({ "delivered-listening-publish-results": published });
  });

  it("does not persist or notify when a quiet event leaves activity unchanged", () => {
    const storageKey = "jl-mixing-listening-activity-v1";
    const activityEvent = "jl-mixing-listening-activity-updated";
    const snapshot: ListeningActivitySnapshot = {
      "delivered-listening-publish-results": published,
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    let notifications = 0;
    const onUpdate = () => { notifications += 1; };
    window.addEventListener(activityEvent, onUpdate);

    recordListeningPublishEvent("delivered-listening-publish-results", quiet);

    expect(JSON.parse(window.sessionStorage.getItem(storageKey) ?? "{}")).toEqual(snapshot);
    expect(notifications).toBe(0);
    window.removeEventListener(activityEvent, onUpdate);
  });
});
