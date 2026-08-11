# JL Mixing Studio Product Requirements Document

**Status:** Current v1.1 product baseline

**Product:** JL Mixing Studio  
**License:** Apache-2.0  
**Automation contract:** API `1.0`  
**Workspace metadata schema:** `1.1.0`  
**Current coordinated provider:** JL Mixing Automation v1.5

## 1. Product summary

JL Mixing Studio is an open-source desktop GUI for small-studio and home-studio mix engineers. It presents JL Mixing Automation workflows and authoritative workspace state through a guided macOS/Windows interface without creating a competing project database.

Studio and Automation are independently versioned. Studio v1.1 admits providers through Automation API `1.0` and capability discovery rather than matching Automation product versions.

## 2. Goals

JL Mixing Studio shall:

1. Make supported JL Mixing Automation workflows approachable without routine terminal use.
2. Preserve Automation-owned project structures, metadata semantics, and filesystem safety.
3. Present studio, client, project, revision, approval, intake, and delivery state clearly.
4. Guide users toward valid next actions while preserving explicit confirmation for mutation.
5. Surface validation findings in plain language with actionable recovery guidance.
6. Keep user data local and projects understandable outside Studio.
7. Support macOS and Windows with equivalent API-backed workflow behavior when a compatible provider is installed.
8. Use capability discovery rather than product-version equality for Automation compatibility.
9. Keep destructive and uncertain operations conservative and auditable.
10. Remain useful without paid services or cloud dependency.

## 3. Non-goals

Studio shall not:

- replace a DAW;
- process mix audio;
- own or reinterpret Automation workflow rules;
- store authoritative project state in a proprietary database;
- silently migrate workspace metadata;
- parse human CLI output as a machine API contract;
- automatically retry an uncertain mutation;
- add archive/reactivation, DAW-template management, collaboration, accounting, or CRM behavior without separate approval.

## 4. Target users

### Primary user

A small-studio or home-studio mix engineer who manages multiple clients/projects and wants a clear guided workflow while retaining local control and transparent project files.

### Contributor

An open-source developer who needs explicit architecture boundaries, reproducible builds, automated tests, and stable compatibility contracts.

## 5. Product principles

1. **GUI over Automation, not a replacement for it.** Automation owns workflow behavior and filesystem mutation.
2. **Workspace data is authoritative.** Studio reflects validated files/metadata rather than creating hidden project truth.
3. **Safe by default.** Validate inputs, paths, provider responses, and destructive plans before execution.
4. **Capability-driven compatibility.** Workflow availability follows Automation API `1.0` discovery and advertised capabilities.
5. **Explain the next step.** Valid next actions and recovery paths should be visible and actionable.
6. **Preserve portability.** Projects remain inspectable and usable without Studio.
7. **Local first.** Core use does not require internet access or a paid hosted service.
8. **Cross-platform by contract.** macOS and Windows consume the same provider API semantics.
9. **No silent compatibility changes.** API/schema/serialized-data changes require explicit design and tests.

## 6. Current v1.1 functional areas

### 6.1 Studio and workspace discovery

- Discover the default workspace and validate supported metadata.
- Load studio, client, project, revision, approval, intake, and delivery state from authoritative workspace files.
- Isolate malformed workspace items so unrelated valid projects remain usable where safe.
- Accept supported POSIX, Windows drive-letter, and UNC root paths under metadata schema `1.1.0`.

### 6.2 Automation provider discovery

Studio shall invoke:

```text
jl-mixing system-info --json
```

and validate:

- API version `1.0`;
- required/feature capabilities;
- provider discovery response structure;
- supported metadata schema compatibility.

Studio shall not require a specific Automation product version.

### 6.3 API-backed workflow set

Studio v1.1 consumes these provider capabilities:

- `client.create`
- `project.create`
- `intake.validate`
- `revision.create`
- `revision.approve`
- `delivery.create`

`system.info` is required for provider discovery/admission.

Studio creation remains a separately controlled human-CLI-backed workflow in v1.1 and is not an Automation API capability.

### 6.4 Client and project creation

- Preview the exact provider operation before mutation.
- Pass user values as structured arguments/request data rather than shell command strings.
- Reconcile the created workspace state after success.
- Preserve provider-defined defaults and validation rules.

### 6.5 Intake validation

- Run provider-owned intake validation.
- Present structured results and provider-authored report content.
- Keep original client delivery files non-destructive.
- Surface skipped external checks where tools are unavailable.

### 6.6 Revision and approval

- Preview and create the next valid revision.
- Preview and approve an eligible revision.
- Preserve provider-owned revision/approval semantics.
- Reconcile authoritative project state after success.

### 6.7 Delivery

- Preview and create the approved revision delivery package.
- Support ZIP creation and same-shape overwrite behavior exposed by the approved Studio UI.
- Guard `--clean` replacement with exact deletion inventory preview, revalidation immediately before execution, explicit typed confirmation, and post-operation reconciliation.
- Preserve edited delivery notes where supported by the approved overwrite workflow.

### 6.8 Read-only inspection

- Present project overview, reports, files, metadata, revision history, approval state, and delivery readiness from validated authoritative data.
- Provide Copy Path and Open Folder actions for validated workspace locations.

### 6.9 Local presentation state

Studio may store local UI preferences such as compact layout or reduced motion. Such settings must not become project truth or modify Automation metadata.

## 7. Platform requirements

### macOS

- Support packaged Studio artifacts produced by the release workflow.
- Preserve compatible Automation discovery and API-backed workflow behavior.

### Windows

- Discover compatible native Automation installations, including Automation v1.5 default installation behavior.
- Resolve supported Windows launcher extensions where applicable.
- Enable API-backed workflows according to capabilities rather than a blanket OS gate.
- Validate Windows workspace path forms covered by schema `1.1.0`.
- Package and exercise the native Windows Studio installer in CI and manual acceptance.

## 8. Compatibility requirements

Studio v1.1:

- supports Automation API `1.0`;
- supports workspace metadata schema `1.1.0`;
- does not require matching Automation product versions;
- tolerates additive compatible provider capabilities/optional response fields as defined by the API contract;
- does not migrate v1.0 workspace data;
- must fail cleanly when Automation is missing, incompatible, malformed, or missing a required capability.

## 9. Safety requirements

- No direct modification of original client delivery files by Studio.
- No shell-string construction from user values for provider operations.
- No automatic retry after an uncertain mutation outcome.
- Destructive delivery replacement requires exact reviewed provider deletion data.
- Post-operation success must be reconciled against authoritative workspace/artifact state.
- Path/open-folder actions operate only on validated resolved paths.

## 10. Release requirements

A Studio release is eligible only when:

1. release metadata is internally consistent;
2. frontend/Rust tests and lint/type/format checks pass;
3. the complete GitHub CI matrix is green;
4. packaged macOS and Windows artifacts are produced successfully;
5. coordinated acceptance against the intended compatible Automation provider is completed for the release's supported workflow scope;
6. release documentation is current; and
7. no release-blocking defect remains.

## 11. Ownership boundary

Automation owns workflow semantics, API schemas/capabilities, provider errors/results, metadata rules, validation, and filesystem mutation.

Studio owns provider admission, presentation, confirmation UX, operating-system integration, local UI preferences, mapping provider results into UI state, and post-operation reconciliation.

Any new persisted cross-product state requires an explicitly approved Automation metadata-schema design rather than Studio-only invention.
