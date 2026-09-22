import type { KeyboardEvent } from "react";

type DialogKeyboardOptions = {
  defaultDisabled?: boolean;
  escapeDisabled?: boolean;
  onDefault?: () => void;
  onEscape?: () => void;
};

const ownsEnterKey = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return target.closest([
    "textarea",
    "select",
    "button",
    "a[href]",
    "input[type='button']",
    "input[type='submit']",
    "input[type='reset']",
    "[role='button']",
    "[contenteditable]:not([contenteditable='false'])",
  ].join(",")) !== null;
};

export const handleDialogKeyDown = (
  event: KeyboardEvent<HTMLElement>,
  { defaultDisabled = false, escapeDisabled = false, onDefault, onEscape }: DialogKeyboardOptions,
) => {
  if (event.defaultPrevented || event.nativeEvent.isComposing) return;

  if (event.key === "Escape" && onEscape && !escapeDisabled) {
    event.preventDefault();
    onEscape();
    return;
  }

  if (
    event.key === "Enter"
    && onDefault
    && !defaultDisabled
    && !event.repeat
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && !ownsEnterKey(event.target)
  ) {
    event.preventDefault();
    onDefault();
  }
};
