# JL Mixing Studio

JL Mixing Studio is an open-source desktop application for small-studio and home-studio mix engineers. It provides a visual, studio-aware workflow over the project structure and automation capabilities established by [JL Mixing Automation](https://github.com/jl-aspect-works/jl-mixing-automation).

## Current release line

JL Mixing Studio v1.1 uses JL Mixing Automation API `1.0` as its provider contract. Studio and Automation are independently versioned; Studio does not require a matching Automation product version.

The current coordinated provider target is JL Mixing Automation v1.5, including native Windows support. Valid workspace metadata remains schema `1.1.0`.

## Product direction

JL Mixing Studio helps engineers:

- Create and manage clients and mix projects.
- Understand project state, revisions, approvals, and delivery status at a glance.
- Run supported JL Mixing Automation workflows through a guided interface.
- Review intake-validation results and actionable warnings.
- Configure studio-specific defaults without hiding the underlying project data.
- Keep projects portable and understandable outside the application.

## Architecture

The accepted architecture is:

- **Desktop framework:** Tauri 2
- **Frontend:** React and TypeScript
- **Desktop integration:** Rust
- **License:** Apache-2.0
- **Platforms:** macOS and Windows

Studio discovers Automation through `jl-mixing system-info --json` and enables API-backed workflows according to the provider's API version and advertised capabilities. The authoritative workflow implementation remains in JL Mixing Automation.

## Supported Automation workflows

Studio v1.1 consumes Automation API `1.0` capabilities for:

- client creation;
- project creation;
- intake validation;
- revision creation;
- revision approval; and
- delivery creation/replacement.

Windows and macOS use the same Automation API contract. Studio creation remains a separate human-CLI-backed path in Studio v1.1 and is not part of the Automation API workflow capability set.

## Workspace compatibility

Studio validates released JL Mixing workspace metadata against schema `1.1.0`, including valid Windows drive-letter and UNC paths introduced for cross-platform Automation operation. Application release versions, Automation API versions, and workspace metadata schema versions are separate compatibility dimensions.

## Development status

The v1.1 implementation is feature-frozen and in coordinated release acceptance with Automation v1.5. Completed work includes:

1. Automation API `1.0` discovery and capability-based workflow availability.
2. Structured client, project, intake, revision, approval, and delivery workflows.
3. Native Windows Automation discovery and API workflow enablement.
4. Windows-compatible workspace schema validation.
5. macOS and Windows packaged application support.
6. Safe delivery replacement with exact preview/revalidation for destructive clean operations.
7. Authoritative post-operation workspace reconciliation.
8. Domain-oriented Rust/frontend refactoring without changing supported workflow behavior.
9. Copy/Open Folder integration and validated project/report/file/metadata views.
10. Local presentation preferences without introducing hidden project state.

See [development status](docs/development-status.md) for the active release state and [Automation API compatibility](docs/automation-api-compatibility.md) for the provider contract.

## Project documents

- [Development status](docs/development-status.md)
- [Automation API compatibility](docs/automation-api-compatibility.md)
- [Developer setup and validation](docs/DEVELOPMENT.md)
- [Product Requirements Document](docs/PRD.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture decision: Tauri 2](docs/adr/0001-tauri-2.md)
- [Definition of Done](docs/DEFINITION_OF_DONE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Contributing

Development uses feature branches and pull requests. Do not commit directly to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
