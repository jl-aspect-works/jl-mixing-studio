<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-dark-product.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-light-product.png">
    <img alt="JL Mixing Studio by JL Aspect Works" width="420" src="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-light-product.png">
  </picture>
</p>

JL Mixing Studio is an open-source desktop application for small-studio and home-studio mix engineers. It provides a visual Daily Workflow over the project structure and authoritative workflow capabilities supplied by [JL Mixing Automation](https://github.com/jl-aspect-works/jl-mixing-automation).

## Current release line

JL Mixing Studio 2.0 supports JL Mixing Automation API `1.0` and workspace metadata schema `1.1.0`. The coordinated stable provider release is JL Mixing Automation 2.0.

Studio and Automation remain independently versioned products. Compatibility is determined from Automation API version, advertised capabilities, and supported metadata schemas rather than requiring matching application version numbers.

## Daily Workflow

After one-time workspace configuration, normal project work is designed to be completed in Studio alongside the DAW without routine use of Finder, Explorer, Terminal, or PowerShell.

Global navigation:

1. Dashboard
2. Studio
3. Clients
4. Projects
5. Tasks
6. Activities
7. Settings

Project navigation:

1. Overview
2. Client Files
3. Audio Prep
4. References
5. Revisions
6. Delivery
7. Files

Studio 2.0 includes structured Client Files validation, Audio Prep validation/provenance and safe working-file mutations, reference management, revision history/notes/approval, authoritative Delivery status/package workflows, controlled project Files navigation, configurable/shared workspaces, storage visibility, and refresh/reconnect behavior.

Embedded audio preview is available on macOS for supported project audio. Windows embedded preview is intentionally deferred beyond 2.0.

## Architecture

- **Desktop framework:** Tauri 2
- **Frontend:** React and TypeScript
- **Desktop integration:** Rust
- **Automation provider contract:** API `1.0`
- **Workspace metadata schema:** `1.1.0`
- **Platforms:** macOS and Windows
- **License:** Apache-2.0

JL Mixing Automation remains authoritative for workflow semantics, metadata, validation, and managed semantic mutation. Studio owns presentation, safe interaction, local configuration/preferences, and explicitly permitted filesystem operations. Workspace data remains authoritative; Studio does not create a competing project-state database.

## Installation

Official Studio packages are currently unsigned. macOS Gatekeeper and Windows SmartScreen may therefore display unknown-developer/publisher warnings.

Before bypassing an operating-system warning, verify the installer against the published `SHA256SUMS.txt`. See the [Studio 2.0 release notes](docs/RELEASE_NOTES_V2.0.md) for exact Intel/Apple Silicon/Windows installer selection and the required Gatekeeper/SmartScreen steps.

JL Mixing Automation is installed separately. See the Automation repository and its 2.0 release notes for its platform-specific installation steps, including the recursive macOS quarantine workaround required by its bundled Python runtime.

## Workspace compatibility

Studio supports local paths, NAS paths, and OS-mounted synchronized/cloud paths as ordinary filesystems. An explicitly configured workspace remains authoritative if temporarily unavailable; Studio does not silently reinterpret it as the default workspace.

Existing valid v1.1-schema workspaces remain compatible with Studio 2.0. No workspace migration is introduced by this release.

## Safety boundaries

- Original Delivery is read-only in Studio.
- Files is a controlled project view rather than an unrestricted file manager.
- Manifest-managed Delivery files remain Automation-owned.
- Non-idempotent operations are not automatically retried after uncertain outcomes.
- Project file operations preserve path-containment and symlink protections.
- Audio Prep Fix/Convert, repair, normalization, and format conversion remain deferred beyond 2.0.

## Project documents

- [Studio 2.0 release notes and installation](docs/RELEASE_NOTES_V2.0.md)
- [Development status](docs/development-status.md)
- [Studio 2.0 / Automation 2.0 coordinated acceptance](docs/v2.0-coordinated-acceptance.md)
- [Automation API compatibility](docs/automation-api-compatibility.md)
- [Developer setup and validation](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Product Requirements Document](docs/PRD.md)
- [Architecture decision: Tauri 2](docs/adr/0001-tauri-2.md)
- [Definition of Done](docs/DEFINITION_OF_DONE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Contributing

Development uses feature branches and pull requests. Do not commit directly to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
