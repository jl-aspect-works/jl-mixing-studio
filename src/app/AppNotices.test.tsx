import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNotices } from "./AppNotices";

const emptyNotices = {
  routeNotice: null,
  studioNotice: null,
  clientNotice: null,
  projectNotice: null,
  intakeNotice: null,
  revisionNotice: null,
  approvalNotice: null,
  deliveryNotice: null,
};

describe("AppNotices", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes routine success feedback after its display interval", () => {
    vi.useFakeTimers();
    render(<AppNotices {...emptyNotices} projectNotice="Blue Sky was created." />);

    expect(screen.getByText("Blue Sky was created.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Blue Sky was created.")).not.toBeInTheDocument();
  });

  it("keeps warning feedback visible", () => {
    vi.useFakeTimers();
    render(<AppNotices {...emptyNotices} routeNotice="The selected project is no longer available." />);

    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByText("The selected project is no longer available.")).toBeInTheDocument();
  });
});
