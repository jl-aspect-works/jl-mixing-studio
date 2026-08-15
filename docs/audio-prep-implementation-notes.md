# Audio Prep first-pass implementation notes

Issue: #192

## Implemented in the Studio quick-win pass

- Functional `02_Audio_Preparation/Working_Audio` browser using the shared validated project-file service.
- Client Files-derived compact table/search/sort presentation.
- Narrow status column reserved for Automation-authored Audio Prep validation/preparation state.
- Inline filename stem rename; the file extension remains protected and is preserved by the backend.
- Safe rename validation remains in the #198 backend: portable characters, reserved Windows names, duplicate/path collisions, case-only rename handling, path containment, and Audio Prep-only mutation scope.
- Safe delete with explicit confirmation.
- Open/Reveal and macOS preview through the existing shared file/preview services.
- `Original Filename` column is present as the provenance location.

## Deliberately not inferred

The current shared Studio file model and Automation interface do not expose a durable prepared-file-to-Original-Delivery mapping. The first-pass UI therefore displays an unavailable marker in `Original Filename` rather than inferring provenance from matching names or filesystem layout.

Automation #116 remains responsible for durable provenance when repair/conversion operations create or replace prepared working files. Studio should consume that authoritative mapping once exposed.

## Deferred to Automation #116 integration

- Audio Prep validation/preparation states such as Ready, Converted, Fixed, Needs Attention, and Review.
- Technical repair/convert actions.
- Revalidation after repair/conversion.
- Authoritative source/origin mapping for each working file.
- Technical metadata beyond what the shared file service currently exposes.

Original Delivery remains immutable throughout.
