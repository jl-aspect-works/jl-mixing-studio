<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-dark-product.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-light-product.png">
    <img alt="JL Mixing Studio by JL Aspect Works" width="420" src="https://raw.githubusercontent.com/jl-aspect-works/jl-brand/main/jl-mixing-studio-light-product.png">
  </picture>
</p>
JL Mixing Studio is an open-source desktop application for small-studio and home-studio mix engineers. It provides a visual Daily Workflow over the project structure and authoritative workflow capabilities supplied by [JL Mixing Automation](https://github.com/jl-aspect-works/jl-mixing-automation).

## Current release line

JL Mixing Studio 2.2 release candidates support JL Mixing Automation API `1.0` and workspace metadata schema `1.1.0`. The coordinated `2.2.0-rc.1` provider is JL Mixing Automation `2.2.0-rc.1`.

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

Studio 2.2 includes the complete 2.1 Daily Workflow plus delivery-note capture, filesystem-based Revision and Delivered Listening, managed listening-copy metadata/artwork, continuous self-healing, contextual publish activity, and an active-project monitor performance pass.

Embedded audio preview is available on macOS and Windows for supported project audio. Windows 2.1 playback uses the native desktop provider; Studio broadly recognizes audio file types for preview eligibility and lets the bundled decoder determine whether the actual file contents are playable.

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

Before bypassing an operating-system warning, verify the installer against the published `SHA256SUMS.txt`. See the [Studio 2.2 release-candidate notes](docs/RELEASE_NOTES_V2.2.md) for exact Intel/Apple Silicon/Windows installer selection and the required Gatekeeper/SmartScreen steps.

JL Mixing Automation is installed separately. Use the coordinated Automation `2.2.0-rc.1` provider for Studio `2.2.0-rc.1` acceptance and follow its platform-specific installation steps, including the recursive macOS quarantine workaround required by its bundled Python runtime.

## Workspace compatibility

Studio supports local paths, NAS paths, and OS-mounted synchronized/cloud paths as ordinary filesystems. An explicitly configured workspace remains authoritative if temporarily unavailable; Studio does not silently reinterpret it as the default workspace.

Existing valid v1.1+ workspaces remain compatible with Studio 2.2. No workspace migration is introduced by this release.

## Safety boundaries

- Original Delivery remains protected from unrestricted mutation; Client Files changes use the managed import workflow.
- Files is a controlled project view rather than an unrestricted file manager.
- Manifest-managed Delivery files remain Automation-owned.
- Non-idempotent operations are not automatically retried after uncertain outcomes.
- Project file operations preserve path-containment and symlink protections.
- Audio Prep repair, normalization, and format conversion remain deferred beyond 2.1.

## Project documents

- [Listening Phase 1 configuration and behavior](docs/LISTENING.md)
- [Studio 2.2 release-candidate notes](docs/RELEASE_NOTES_V2.2.md)
- [Studio 2.2 release acceptance matrix](docs/RELEASE_ACCEPTANCE_V2.2.md)
- [Studio 2.1 release notes and installation](docs/RELEASE_NOTES_V2.1.md)
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
