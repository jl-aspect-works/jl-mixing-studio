import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  it("marks routine success for the transient success treatment", () => {
    render(<AppNotices {...emptyNotices} revisionNotice="Revision 2 was created." />);

    const notice = screen.getByText("Revision 2 was created.").closest("section");
    expect(notice).toHaveClass("notice", "success");
    expect(notice).not.toHaveClass("warning");
  });

  it("keeps attention messages out of the transient success treatment", () => {
    render(<AppNotices {...emptyNotices} routeNotice="The selected project is no longer available." />);

    const notice = screen.getByText("The selected project is no longer available.").closest("section");
    expect(notice).toHaveClass("notice", "warning");
    expect(notice).not.toHaveClass("success");
  });
});
