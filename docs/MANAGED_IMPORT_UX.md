# Managed import UX implementation note

The v2.1 import dialog keeps the user in one workflow from source review through project readiness:

- selected ZIP/folder/files show a visible review/scanning state;
- the review table is replaced by a primary progress view while import executes;
- execution progress uses the monotonic progress presentation introduced by PR #315;
- after import succeeds, the same dialog shows intake validation/finalization progress;
- `Project ready` appears only after that follow-up validation has started and completed.

This reconciles the still-useful UX from draft PR #309 without carrying forward its older phase-local progress calculation or synthetic Rust staging event.
