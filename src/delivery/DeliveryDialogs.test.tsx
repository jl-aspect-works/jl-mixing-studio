import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryOptionsDialog } from "./DeliveryDialogs";

afterEach(cleanup);

const renderDialog = (overrides: Partial<Parameters<typeof DeliveryOptionsDialog>[0]> = {}) => {
  const onBuild = vi.fn();
  const onClose = vi.fn();
  render(<DeliveryOptionsDialog
    approvedRevision={2}
    showCleanOption
    cleanFirst={false}
    deliveryNote=""
    deliveryNoteLoading={false}
    deliveryNoteError={null}
    deliveryNoteMaxBytes={65_536}
    onCleanFirstChange={vi.fn()}
    onDeliveryNoteChange={vi.fn()}
    onBuild={onBuild}
    onClose={onClose}
    {...overrides}
  />);
  return { onBuild, onClose };
};

describe("DeliveryOptionsDialog keyboard defaults", () => {
  it("builds the package when Enter is pressed in the dialog", () => {
    const { onBuild } = renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Build Package" }), { key: "Enter" });

    expect(onBuild).toHaveBeenCalledOnce();
  });

  it("does not build while the primary action is disabled", () => {
    const { onBuild } = renderDialog({ deliveryNoteLoading: true });

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Build Package" }), { key: "Enter" });

    expect(onBuild).not.toHaveBeenCalled();
  });

  it("leaves Enter available for multiline delivery notes", () => {
    const { onBuild } = renderDialog();

    fireEvent.keyDown(screen.getByRole("textbox", { name: /Delivery Note/i }), { key: "Enter" });

    expect(onBuild).not.toHaveBeenCalled();
  });
});
