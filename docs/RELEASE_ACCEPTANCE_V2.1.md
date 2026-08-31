# JL Mixing Studio 2.1 Release Acceptance

This is the high-level sanity acceptance pass for coordinated JL Mixing Studio 2.1 and JL Mixing Automation 2.1 release candidates. It is intentionally shorter than a full regression suite. The goal is to confirm that packaged builds install, launch, and support the primary daily workflow on representative local and shared/NAS workspaces.

Use the coordinated Automation and Studio release candidates intended for the test pass. Record `Pass`, `Fail`, or `N/A` for each platform. Any release-blocking failure should be recorded as an issue before advancing the release.

## Test environment

| Item | Windows | macOS |
| --- | --- | --- |
| Studio version |  |  |
| Automation version |  |  |
| OS version |  |  |
| Workspace type/path |  |  |
| Tester/date |  |  |

## Acceptance matrix

| ID | Area | Sanity test | Expected result | Windows | macOS | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | Install / launch | Install the published package and launch Studio. | Installation completes, Studio launches normally, and the displayed version matches the candidate being tested. |  |  |  |
| A02 | Automation discovery | Start Studio with the coordinated Automation candidate installed. | Studio discovers a compatible Automation provider and the workspace opens without compatibility errors. |  |  |  |
| A03 | Existing workspace | Open a representative existing workspace and navigate Dashboard, Clients, Projects, Tasks, Activities, and Settings. | Existing data loads correctly, navigation works, and no unexpected migration or corruption occurs. |  |  |  |
| A04 | New project | Create a new project using normal project metadata and optional initial Client Files import. | Project is created successfully, appears in Studio, and imported files are reflected correctly. |  |  |  |
| A05 | Metadata editing | Edit representative Studio, client, and project metadata. | Changes save successfully and remain correct after refresh/reopen. |  |  |  |
| A06 | Client Files import | Import representative additional Client Files, including a ZIP when practical. Exercise Add/Skip conflict handling and Select All. | Plan and execute behave correctly, selected files are imported once, conflicts follow the chosen action, and the resulting Client Files/Audio Prep state is correct. |  |  |  |
| A07 | Large/NAS import progress | On a shared/NAS workspace, run a representative larger import. | Checking, Preparing, Importing, import finalization, and imported-file checking visibly progress; Finalizing project remains visibly active until completion; 100% is not shown before the operation is actually complete. |  |  |  |
| A08 | Validation / project health | Run or trigger intake validation on representative imported audio and review Project Health. | Validation completes, findings display correctly, and project-level health reflects Audio Prep/audio readiness without treating non-blocking Client Files findings as project failure. |  |  |  |
| A09 | Audio Prep reset | Run the managed Audio Prep reset on a representative project. | Reset plan/execute completes and Working Audio is rebuilt from current Client Files without unexpected file changes. |  |  |  |
| A10 | Revision lifecycle | Create a revision and exercise representative lifecycle actions: Approve/Unapprove and Close/Reopen. | Revision status changes are correct, current-revision behavior remains coherent, and project status updates appropriately. |  |  |  |
| A11 | Tasks / Activities | Use search and filter controls on Tasks and Activities. | Search/filter controls respond correctly, results update as expected, and control layout remains usable. |  |  |  |
| A12 | Audio preview | Preview representative supported audio files from Studio. | Playback controls work for decodable files and unsupported/undecodable content fails gracefully rather than breaking the UI. |  |  |  |
| A13 | Project Files / path actions | Browse Project Files and use representative Open Folder / path actions. | Files view is usable and filesystem actions open/copy the intended location on the current platform. |  |  |  |
| A14 | Delivery | Edit delivery notes and build a representative delivery/package using the normal options. | Delivery state loads correctly, package creation completes, and the expected delivery output is present and accessible. |  |  |  |
| A15 | Shared-workspace refresh | Make a representative workspace change, then refresh/reopen Studio or the affected project. | Studio reflects authoritative workspace state without stale or duplicated data. |  |  |  |
| A16 | Restart / persistence | Close and relaunch Studio after completing the workflow above. | Workspace selection, saved metadata, project/revision state, and other persistent settings reload correctly. |  |  |  |
| A17 | Responsiveness sanity | During normal navigation and the workflow above, watch for obvious hangs, excessive duplicate work, or regressions in responsiveness. | Common navigation and editing remain responsive; long NAS/file operations show active feedback rather than appearing frozen. |  |  |  |

## Acceptance result

### Windows

- [ ] Pass
- [ ] Fail — release-blocking findings recorded below

### macOS

- [ ] Pass
- [ ] Fail — release-blocking findings recorded below

## Release-blocking findings

Record only findings that must be fixed before advancing the release. Minor follow-up work may be explicitly deferred to a later release.

| Platform | Issue | Summary | Disposition |
| --- | --- | --- | --- |
|  |  |  |  |
