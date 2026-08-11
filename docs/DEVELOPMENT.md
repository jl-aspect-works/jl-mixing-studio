# Development setup

JL Mixing Studio is a Tauri 2 desktop application built with React, TypeScript, and Rust. The v1.1 line consumes JL Mixing Automation through Automation API `1.0` for its existing provider-backed workflow set.

## Requirements

- Git
- Node.js 22 LTS or 24 LTS with npm
- stable Rust toolchain with Cargo, Clippy, and rustfmt
- Tauri 2 operating-system build prerequisites
- a compatible JL Mixing Automation API `1.0` provider when exercising Automation-backed workflows

Studio and Automation product versions are independent. Current coordinated development/acceptance uses JL Mixing Automation v1.5, but Studio admission is based on API `1.0`, required capabilities, and supported metadata schema `1.1.0`.

## macOS prerequisites

Install Apple's Command Line Tools:

```shell
xcode-select --install
```

Install a supported Node.js LTS release and a stable Rust toolchain. An existing package-managed Rust installation is acceptable when `rustc`, Cargo, Clippy, and rustfmt are available.

## Windows prerequisites

Follow the official Tauri 2 Windows prerequisites. A normal setup includes:

- supported Node.js LTS;
- stable Rust with the Microsoft MSVC toolchain;
- Microsoft C++ Build Tools; and
- WebView2 where the operating system does not already provide it.

Native Automation v1.5 can be used for Windows API workflow testing. Studio v1.1 supports Windows provider discovery and API-backed client/project/intake/revision/approval/delivery workflows.

## Get the source

```shell
mkdir -p ~/Development/jl-aspect-works
cd ~/Development/jl-aspect-works
git clone https://github.com/jl-aspect-works/jl-mixing-studio.git
cd jl-mixing-studio
npm ci
```

A global Tauri CLI installation is not required; repository dependencies provide the required CLI tooling.

## Verify the Automation provider

From a shell where Automation is installed:

```text
jl-mixing system-info --json
```

The provider must report compatible Automation API `1.0`. Workflow availability is then evaluated by advertised capability.

Studio v1.1 consumes:

```text
system.info
client.create
project.create
intake.validate
revision.create
revision.approve
delivery.create
```

Automation may advertise additional compatible capabilities. Studio must not infer compatibility from the Automation application release number.

## Provider discovery

### macOS

Studio preserves supported installed/default/PATH discovery behavior for Automation providers.

### Windows

Studio supports native Automation discovery, including the v1.5 default installation under the user's local application-data Programs location and compatible Windows launcher extensions (`.exe`, `.cmd`, `.bat`) where applicable.

## Workspace compatibility

Studio v1.1 validates workspace metadata schema `1.1.0`.

Supported root-path forms include:

- valid POSIX absolute paths;
- Windows drive-letter absolute paths; and
- Windows UNC absolute paths covered by the authoritative schema snapshot.

No workspace migration is performed by Studio.

## Run the frontend

```shell
npm run dev
```

The browser-only frontend cannot call native Tauri commands. Use it for layout/component work with mocks or test fixtures.

## Run the desktop application

```shell
npm run tauri dev
```

The Tauri application owns operating-system integration and the Rust boundary to provider discovery/workflows. Frontend code does not select arbitrary executables, manifest paths, or workspaces for provider mutation.

## Automation workflow architecture

API-backed Studio workflows use the same safety pattern:

1. resolve and admit the Automation provider;
2. validate the required capability;
3. obtain a structured provider preflight/plan where applicable;
4. present Studio-owned confirmation UX;
5. execute the structured provider operation;
6. treat uncertain mutation outcomes conservatively with no automatic retry; and
7. reconcile authoritative workspace/artifact state after success.

Studio creation is separate in v1.1: it remains a controlled human-CLI-backed operation rather than an Automation API capability.

## Safety invariants

- Automation remains authoritative for workflow rules and filesystem mutation.
- Human CLI output is not a machine API contract.
- User values are not interpolated into shell command strings for API-backed operations.
- Destructive delivery clean replacement requires exact provider deletion inventory, revalidation immediately before execution, explicit confirmation, and post-operation reconciliation.
- Original client delivery content remains outside Studio mutation ownership.
- Local Studio preferences must not become hidden project state.

## Quality gates

Before opening or updating a release-affecting PR, run the applicable checks:

```shell
npm ci
npm run check
```

Use the repository's Rust test/format/lint commands and any release-version verification required by the target release tag. GitHub CI remains the authoritative cross-platform gate.

Release preparation also validates packaged macOS and Windows installers and coordinated behavior against the intended Automation provider.

## Release workflow

1. Implement changes on a feature/fix/documentation branch.
2. Open a PR to `main`; never modify `main` directly.
3. Require applicable CI to pass.
4. Merge the reviewed PR.
5. Prepare release-version metadata on a dedicated release branch/PR when needed.
6. Tag only the reviewed green merge commit.
7. Verify generated installers/artifacts.
8. Perform packaged coordinated acceptance before stable publication.

## Documentation ownership

Current release behavior should be reflected in:

- `README.md`
- `docs/development-status.md`
- `docs/automation-api-compatibility.md`
- `docs/PRD.md`
- `docs/ROADMAP.md`
- this developer guide

Historical acceptance records should remain historically accurate rather than being rewritten to claim newer provider/platform testing that did not occur.
