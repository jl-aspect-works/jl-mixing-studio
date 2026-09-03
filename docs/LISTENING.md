# Listening Phase 1

JL Mixing Studio publishes convenient listening copies from authoritative project audio to ordinary filesystem folders. Revision Listening supports mix review before delivery; Delivered Listening maintains the current successfully delivered mix. Publishing is secondary to the project workflow and never changes whether a revision or delivery succeeds.

## Configure destinations

Open **Settings > Listening**. Revision Listening and Delivered Listening are configured independently, and each class may have multiple enabled destinations. Every destination has its own:

- display name;
- local, mounted NAS/shared, or OS-synced folder;
- required file extension;
- metadata policy; and
- artwork policy.

A NAS share or synchronized folder must already be mounted and available as a normal filesystem path. Studio does not authenticate to storage providers or upload through a cloud API.

If `listening.json` does not exist, Listening remains disabled with no destinations. Existing studios and projects therefore require no migration. Listening configuration is local to the Studio installation and does not alter project manifests or the Automation API contract.

## Published layout

Studio creates a folder for the project client beneath each destination:

```text
[destination]/[client-id]/[project-id]-rev-[NN].[format]  Revision Listening
[destination]/[client-id]/[project-id].[format]           Delivered Listening
```

Revision filenames are stable for a revision. Delivered filenames deliberately omit the revision number and are replaced after a later successful delivery.

## Source and format rules

Revision Listening selects the newest matching regular file directly in the current `04_Revisions/Revision_NN` folder. It does not search `Variants/` or other subfolders, so alternate versions placed there are preserved without being published as the primary listening copy. Studio never silently substitutes a variant.

Delivered Listening follows the source provenance recorded by the successful delivery. Older delivery manifests without source provenance use the documented deterministic legacy fallback; Studio does not guess when multiple candidates are ambiguous.

The required extension is exact apart from letter case. Studio does not transcode and does not fall back to another format. If a destination requires MP3 and the current revision or delivery contains only WAV, that destination quietly waits for an MP3 source. This is normal—not an error or warning.

## Metadata and artwork

Metadata policies are:

- **Off** — leave copied metadata unchanged.
- **Fill Missing** — retain populated fields and fill empty managed fields.
- **Replace** — set Artist and Album Artist from the client name, Album from the project name, Genre to `JL Mixing`, and a context-specific Title. Revision titles include `Rev NN`; Delivered titles do not. Delivered copies also receive the `Current Listening Copy` comment.

Artwork policies are:

- **Off** — do not add or alter artwork.
- **Preserve Existing** — keep existing artwork and fill missing artist-folder sidecars.
- **Replace with Studio Artwork** — use the approved JL Mixing Studio Listening cover.

Only the published copy and destination-side artwork are modified. Authoritative revision and delivery files remain byte-for-byte untouched. See [Listening artwork](LISTENING_ARTWORK.md) for the embedded and companion-artwork rules.

## Automatic reconciliation

While a project is open, Studio checks Revision and Delivered Listening approximately once per second. It waits for a revision source to remain unchanged across three samples before publishing, avoiding partially written DAW bounces. Missing or stale listening audio, metadata, and artwork are recreated automatically.

Recovery normally occurs within a few seconds after the source becomes stable. Mounted-storage latency can extend that time, and a failed destination is retried with a short backoff rather than on every poll. A newly created delivery also receives an immediate reconciliation attempt. Routine current/missing-format checks stay quiet; changed failures and recoveries are retained in the production [diagnostic log](DIAGNOSTIC_LOGGING.md).

## Media-server behavior

Plex and Navidrome support in Phase 1 is filesystem publishing only. Studio does not call their APIs, trigger library scans, manage matches, or control how quickly their caches refresh. Embedded metadata and artwork make the copies media-library friendly, but a server may still need its own scheduled/manual scan or metadata preference changes before the updated presentation appears.

Media-server APIs, remote publishing, playlists, and transcoding remain outside Phase 1.
