# JL Mixing Studio Automation API Compatibility Policy

## Purpose

JL Mixing Studio and JL Mixing Automation use independent product versions. Studio determines provider compatibility from the Automation API version and advertised capabilities, not from the Automation application release number.

## Studio v1.1 provider contract

JL Mixing Studio v1.1 supports Automation API `1.0`.

Studio discovers the provider through:

```text
jl-mixing system-info --json
```

The response must declare API `1.0` and the capabilities required by the workflow Studio intends to use.

Studio v1.1 consumes:

- `system.info`
- `client.create`
- `project.create`
- `intake.validate`
- `revision.create`
- `revision.approve`
- `delivery.create`

Automation may advertise additional compatible API 1.0 capabilities. Studio must not reject a provider merely because it exposes additive capabilities or a different Automation product release.

Studio creation remains outside this API-backed capability set in Studio v1.1 and continues through the separately controlled human CLI path.

## Current coordinated provider

The current coordinated provider target is JL Mixing Automation v1.5. Automation v1.5 retains API `1.0` and workspace metadata schema `1.1.0` while adding native Windows support and a shared cross-platform runtime.

The original Studio v1.1.0 release was acceptance-tested against Automation v1.4.0. That historical result remains valid for the tested release pair; the current v1.5 coordination extends the same API 1.0 consumer contract to Windows and validates the post-release compatibility fixes merged into Studio v1.1.

## Compatibility rule

Studio v1.1 accepts Automation API `1.0` exactly and evaluates workflow availability by capability.

Studio must not infer API compatibility from:

- Automation product version;
- Studio product version;
- workspace metadata schema version; or
- human CLI output.

Application release, Automation API, and metadata schema versions are independent contracts.

## Discovery behavior

The centralized Studio discovery path:

1. locates a supported Automation launcher;
2. invokes `jl-mixing system-info --json` without a shell command string;
3. requires one valid discovery document;
4. validates API version `1.0`;
5. validates required capability names; and
6. returns a structured compatibility result to the frontend.

### macOS

Studio preserves supported installed/default/PATH discovery behavior for Automation providers.

### Windows

Studio v1.1 supports native Windows Automation discovery, including the v1.5 default installation beneath the user's local application-data Programs location and compatible `.exe`, `.cmd`, or `.bat` launchers found through supported discovery rules.

Workflow availability is capability-driven on Windows. Windows is not blanket-disabled when a compatible Automation API provider is present.

## Workspace compatibility

Studio v1.1 supports metadata schema `1.1.0`, including the authoritative cross-platform schema forms used by Automation v1.5 for valid POSIX, Windows drive-letter, and UNC root paths.

No metadata migration is introduced by Studio v1.1. Product-version changes do not imply metadata-schema changes.

## Failure classes

Studio distinguishes:

- **Automation missing** — no usable provider launcher can be located.
- **Invocation failed** — Automation was located but discovery could not be executed successfully.
- **Malformed response** — discovery output is not valid for the expected document.
- **API unavailable** — discovery does not provide a usable API declaration.
- **API incompatible** — the declared API version is not supported by Studio v1.1.
- **Capability unavailable** — API 1.0 is supported but the requested workflow capability is absent.

These are structured Studio conditions rather than strings parsed from provider stdout/stderr.

## Graceful degradation

Failure to locate or admit Automation does not make Studio unusable. Supported read-only workspace functionality remains available where its own prerequisites are satisfied. Automation-backed actions are disabled or fail cleanly with actionable guidance.

Studio must not silently fall back to legacy human workflow commands for API-backed mutations after provider discovery fails or becomes incompatible. That would bypass the API contract and could make uncertain mutation outcomes unsafe.

## Ownership

Automation owns:

- provider workflow semantics;
- API schemas and examples;
- capability names;
- response envelopes and machine error codes;
- filesystem mutation and provider-side transaction behavior.

Studio owns:

- supported Automation API versions;
- provider discovery/admission;
- capability-to-feature availability;
- confirmation and operating-system UX;
- mapping provider results into Studio domain state;
- authoritative post-operation reconciliation; and
- consumer regression/packaged acceptance tests.

## Release implications

Compatibility-policy changes require a reviewed Studio source change and release. Studio does not download or silently replace its compatibility declaration at runtime.

A future Automation product release can remain compatible with Studio v1.1 as long as it continues to satisfy the Automation API 1.0 and metadata-schema contracts consumed by Studio. Matching product version numbers never imply compatibility.
