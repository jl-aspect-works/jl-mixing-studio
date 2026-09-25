# Safe content deletion

Studio supports permanent deletion of regular files and folders **inside** these project areas:

- `01_Client_Files/Original_Delivery/`
- `02_Audio_Preparation/Working_Audio/`
- `02_Audio_Preparation/Rejected_Files/`

The managed area roots themselves, other project areas, symbolic links, and folders containing symbolic links or unsupported filesystem entries cannot be deleted through this operation. Existing revision-file and reference-file actions remain separate. Original Delivery deletion requires an Automation installation advertising `client.files.delete.plan` and `client.files.delete.execute`. Automation updates the lineage record when an imported source is deleted; existing Working Audio copies are retained and identified in the confirmation. Unreadable or unfamiliar provenance blocks Original Delivery deletion.

Studio asks the Rust backend for a summary with file/folder counts, byte count, and a snapshot fingerprint. For a folder, the user must type its exact name. Execution recomputes the summary and rejects a stale fingerprint or mismatched name. Studio refreshes the authoritative listing after success. The confirmation has no Enter-key default.

Deletion is permanent and has no trash or undo. The relevant backend first moves the selected item to a temporary sibling name before recursive cleanup. If cleanup fails, the operation reports the remaining `.jl-mixing-deleting-*` path and must not be retried automatically; inspect that residual content manually. Other applications should stop writing to the selected folder while deletion is planned and executed. The snapshot is not a cross-process filesystem lock.

This operation does not delete whole projects or clients, change delivery manifests, or remove external Listening copies.
