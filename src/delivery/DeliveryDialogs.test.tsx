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

  it("restores focus to Build Package when Delivery Notes finish loading", () => {
    const props = {
      approvedRevision: 2,
      showCleanOption: true,
      cleanFirst: false,
      deliveryNote: "",
      deliveryNoteError: null,
      deliveryNoteMaxBytes: 65_536,
      onCleanFirstChange: vi.fn(),
      onDeliveryNoteChange: vi.fn(),
      onBuild: vi.fn(),
      onClose: vi.fn(),
    };
    const view = render(<>
      <button type="button" autoFocus>Open package dialog</button>
      <DeliveryOptionsDialog {...props} deliveryNoteLoading />
    </>);
    expect(screen.getByRole("button", { name: "Open package dialog" })).toHaveFocus();

    view.rerender(<>
      <button type="button">Open package dialog</button>
      <DeliveryOptionsDialog {...props} deliveryNoteLoading={false} />
    </>);

    const build = screen.getByRole("button", { name: "Build Package" });
    expect(build).toHaveFocus();
  });

  it("leaves Enter available for multiline delivery notes", () => {
    const { onBuild } = renderDialog();

    fireEvent.keyDown(screen.getByRole("textbox", { name: /Delivery Note/i }), { key: "Enter" });

    expect(onBuild).not.toHaveBeenCalled();
  });
});
