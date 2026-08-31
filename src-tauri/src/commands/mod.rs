#[path = "delivered_listening_command.rs"]
pub(crate) mod delivered_listening;
#[path = "delivery_notes_command.rs"]
mod delivery_notes;
#[path = "folder_command.rs"]
mod folders;
#[path = "listening_metadata.rs"]
mod listening_metadata;
// #342 consumes the shared publish/read path. Configuration writes become production-reachable
// from the Listening settings UX in #346, so keep dead-code allowance scoped to this module until
// that handoff lands.
#[allow(dead_code)]
#[path = "listening_publish_with_metadata.rs"]
mod listening_publish;
#[path = "native_audio_preview_command.rs"]
mod native_audio_preview;
#[path = "project_file_open_command.rs"]
mod project_file_open;
#[path = "project_file_summary_command.rs"]
mod project_file_summary;
#[path = "project_file_command.rs"]
mod project_files;
#[path = "project_reference_command.rs"]
mod project_references;
#[path = "project_revision_file_command.rs"]
mod project_revision_files;
#[path = "revision_description_command.rs"]
mod revision_description;
#[path = "revision_listening_command.rs"]
pub(crate) mod revision_listening;
#[path = "revision_notes_command.rs"]
mod revision_notes;
#[path = "system_command.rs"]
mod system;
mod workspace_command_support;
#[path = "workspace_configuration_command.rs"]
mod workspace_configuration;
#[path = "workspace_storage_summary_command.rs"]
mod workspace_storage_summary;

pub(crate) use delivered_listening::publish_after_delivery_creation;
pub(super) use delivery_notes::{get_delivery_notes, update_delivery_notes};
pub(super) use folders::{open_folder, resolve_folder};
// #342 consumes the shared publish engine; configuration writes remain reserved for the settings
// UX in #346.
#[allow(unused_imports)]
pub(crate) use listening_publish::{
    listening_configuration, publish_listening_copy, save_listening_configuration,
};
pub(super) use native_audio_preview::{
    get_native_project_audio_preview_status, load_native_project_audio_preview,
    pause_native_project_audio_preview, play_native_project_audio_preview,
    seek_native_project_audio_preview, set_native_project_audio_preview_volume,
    stop_native_project_audio_preview,
};
pub(super) use project_file_open::{
    open_project_file, prepare_project_audio_preview, reveal_project_file,
};
pub(super) use project_file_summary::summarize_project_files;
pub(super) use project_files::{delete_project_file, list_project_files, rename_project_file};
pub(super) use project_references::{add_project_reference, delete_project_reference};
pub(crate) use project_revision_files::ListeningSourceSelection;
pub(super) use project_revision_files::{delete_revision_file, rename_revision_file};
pub(super) use revision_description::update_revision_description;
pub(super) use revision_listening::{
    start_revision_listening_monitor, RevisionListeningMonitorState,
};
pub(super) use revision_notes::{get_revision_notes, update_revision_notes};
pub(super) use system::{discover_default_workspace, get_jl_mixing_version, get_system_info};
pub(super) use workspace_configuration::{
    choose_workspace_folder, get_workspace_configuration, set_workspace_root,
    validate_workspace_root,
};
pub(super) use workspace_storage_summary::summarize_workspace_storage;

#[cfg(test)]
pub(super) use delivery_notes::{
    read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES,
};
#[cfg(test)]
pub(super) use folders::intake_directory;

pub(crate) use workspace_command_support::{
    find_project_summary, resolve_home, validated_project_directory,
};
pub(crate) use workspace_configuration::resolve_workspace_root;
