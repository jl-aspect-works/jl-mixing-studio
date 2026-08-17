import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../SuccessFeedback.css";
import { AppNotices } from "./AppNotices";

afterEach(cleanup);

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

describe("Studio success feedback", () => {
  it("renders routine success as a fixed auto-clearing overlay", () => {
    render(<AppNotices {...emptyNotices} revisionNotice="Revision 2 was created." />);

    const notice = screen.getByText("Revision 2 was created.").closest("section");
    expect(notice).toHaveClass("notice", "success");
    expect(getComputedStyle(notice!).position).toBe("fixed");
    expect(getComputedStyle(notice!).animationName).toContain("studio-success-toast");
  });

  it("keeps attention messages in normal page flow", () => {
    render(<AppNotices {...emptyNotices} routeNotice="The selected project is no longer available." />);

    const notice = screen.getByText("The selected project is no longer available.").closest("section");
    expect(notice).toHaveClass("notice", "warning");
    expect(getComputedStyle(notice!).position).not.toBe("fixed");
  });
});
