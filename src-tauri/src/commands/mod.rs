#[path = "delivery_notes_command.rs"]
mod delivery_notes;
#[path = "folder_command.rs"]
mod folders;
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
#[path = "revision_notes_command.rs"]
mod revision_notes;
#[path = "system_command.rs"]
mod system;
mod workspace_command_support;
#[path = "workspace_configuration_command.rs"]
mod workspace_configuration;
#[path = "workspace_storage_summary_command.rs"]
mod workspace_storage_summary;

pub(super) use delivery_notes::{get_delivery_notes, update_delivery_notes};
pub(super) use folders::{open_folder, resolve_folder};
pub(super) use project_file_open::{
    open_project_file, prepare_project_audio_preview, reveal_project_file,
};
pub(super) use project_file_summary::summarize_project_files;
pub(super) use project_files::{delete_project_file, list_project_files, rename_project_file};
pub(super) use project_references::{add_project_reference, delete_project_reference};
pub(super) use project_revision_files::{delete_revision_file, rename_revision_file};
pub(super) use revision_description::update_revision_description;
pub(super) use revision_notes::{get_revision_notes, update_revision_notes};
pub(super) use system::{discover_default_workspace, get_jl_mixing_version, get_system_info};
pub(super) use workspace_configuration::{
    get_workspace_configuration, set_workspace_root, validate_workspace_root,
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
pub(crate) use workspace_configuration::{resolve_workspace_root, workspace_configuration};
