import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import successFeedbackCss from "../SuccessFeedback.css?raw";
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
  it("renders routine success with the fixed auto-clearing toast treatment", () => {
    render(<AppNotices {...emptyNotices} revisionNotice="Revision 2 was created." />);

    const notice = screen.getByText("Revision 2 was created.").closest("section");
    expect(notice).toHaveClass("notice", "success");
    expect(successFeedbackCss).toMatch(/\.notice\.success\s*\{[\s\S]*?position:\s*fixed;/);
    expect(successFeedbackCss).toMatch(/animation:\s*studio-success-toast\s+4s/);
  });

  it("keeps attention messages out of the transient success treatment", () => {
    render(<AppNotices {...emptyNotices} routeNotice="The selected project is no longer available." />);

    const notice = screen.getByText("The selected project is no longer available.").closest("section");
    expect(notice).toHaveClass("notice", "warning");
    expect(notice).not.toHaveClass("success");
  });
});
