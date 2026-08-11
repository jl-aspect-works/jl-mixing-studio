# JL Mixing Studio Roadmap

**Status:** Living, version-agnostic roadmap

## Product role

JL Mixing Studio is the desktop user experience for the JL Mixing ecosystem. JL Mixing Automation remains authoritative for workflow rules, validation, filesystem mutation, and the machine-facing Automation API. Workspace metadata and supported reports remain authoritative for project state.

## Versioning and compatibility

Studio versions independently from JL Mixing Automation. Each Studio release declares:

- supported Automation API versions;
- required and optional Automation capabilities;
- supported workspace metadata schemas.

Studio v1.1 supports Automation API `1.0` and metadata schema `1.1.0`. Product-version equality between Studio and Automation is neither required nor sufficient for compatibility.

## Completed foundation milestones

### Automation API adoption

Studio v1.1 completed the clean cutover to Automation API `1.0` for its existing provider-backed workflow set. Client, project, intake, revision, approval, and delivery operations use structured API contracts rather than parsing human CLI output.

The compatibility layer now provides:

- `jl-mixing system-info --json` discovery;
- API-version admission;
- capability-based workflow availability;
- structured provider error/result handling;
- authoritative post-operation reconciliation; and
- no automatic fallback to legacy mutation commands after uncertain API outcomes.

### Windows platform enablement

The Windows platform milestone is implemented for the existing API-backed workflow set in the v1.1 line when used with compatible Automation v1.5 providers.

Completed support includes:

- native Windows Automation discovery;
- Windows launcher extension handling;
- Windows drive-letter and UNC workspace-schema validation;
- capability-backed client/project/intake/revision/approval/delivery workflows;
- native Studio Windows packaging and CI coverage; and
- shared API behavior across Windows and macOS.

Studio creation remains a separately controlled human-CLI-backed operation in v1.1 and is not part of the Automation API capability set.

## Current release priority

Complete packaged coordinated acceptance of the refreshed Studio v1.1 line against JL Mixing Automation v1.5, fix only confirmed release defects, keep documentation current, and publish a refreshed Studio release only from a reviewed green merge commit.

## Future-feature policy

Future work stays version-agnostic until its behavior, ownership, API/schema impact, compatibility requirements, and test plan are explicitly approved. Discussion of a feature does not assign it to a release.

## Candidate roadmap themes

### Search and navigation

- global search over authoritative workspace data;
- recent projects and favorites stored as local presentation state;
- richer filters and saved local views;
- keyboard-first navigation improvements.

### Reporting and visibility

- printable/exportable project summaries;
- improved intake, revision, approval, and delivery views;
- library statistics and project-status summaries;
- project-health presentation backed by Automation-owned checks when new checks are required.

### Workflow usability

- clearer progress and cancellation boundaries;
- improved notifications and actionable error presentation;
- drag-and-drop entry points that invoke existing supported provider operations;
- background execution queues without automatic retry after uncertain mutations.

### Advanced workflows

Candidates requiring explicit cross-product design may include:

- batch intake/validation;
- batch project operations;
- file watching/change detection;
- project templates beyond current provider defaults;
- structured project-health operations;
- task/deadline workflows that require persisted cross-product state;
- archive/restore behavior.

### Studio-aware future

Longer-term candidates include session intelligence, recall management, asset management, backup awareness, studio inventory, and optional client-facing delivery workflows. Each must pass the ownership and metadata/API impact review before implementation.

## Ownership boundaries

Studio owns presentation, local UI preferences, rebuildable indexes, provider admission, operating-system UX, confirmation flows, and consumer-side reconciliation.

Automation owns workflow rules, validation, project writes, stable API behavior, provider capability definitions, and filesystem safety.

Persisted cross-product information requires an explicitly approved metadata-schema change. Studio should not create hidden project truth that competes with workspace files.

## Release planning

A release milestone contains only approved issues. Cross-repository features should use linked Automation and Studio issues with clearly separated ownership.

## Features intentionally outside scope

Studio should not become a DAW, accounting package, general CRM, mandatory cloud service, or independent replacement for Automation workflow logic.
