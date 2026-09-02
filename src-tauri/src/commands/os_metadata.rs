use std::ffi::OsStr;
use std::path::Path;

/// Returns true for operating-system-generated metadata that is never a JL Mixing project
/// artifact. The policy is deliberately platform-neutral because workspaces may be shared across
/// macOS and Windows through a NAS or cloud sync.
pub(crate) fn is_ignored_os_metadata_name(name: &OsStr) -> bool {
    let name = name.to_string_lossy();
    name == ".DS_Store"
        || name.starts_with("._")
        || name.eq_ignore_ascii_case("Thumbs.db")
        || name.eq_ignore_ascii_case("desktop.ini")
}

pub(crate) fn is_ignored_os_metadata_path(path: &Path) -> bool {
    path.file_name().is_some_and(is_ignored_os_metadata_name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_the_same_explicit_metadata_set_on_every_platform() {
        for name in [
            ".DS_Store",
            "._Mix.wav",
            "Thumbs.db",
            "THUMBS.DB",
            "desktop.ini",
            "Desktop.INI",
        ] {
            assert!(is_ignored_os_metadata_name(OsStr::new(name)), "{name}");
        }
    }

    #[test]
    fn preserves_legitimate_dotfiles_and_user_files() {
        for name in [
            ".gitignore",
            ".mix-notes",
            "DS_Store",
            "mix._draft.wav",
            "Thumbs.db.txt",
            "desktop.ini.bak",
        ] {
            assert!(!is_ignored_os_metadata_name(OsStr::new(name)), "{name}");
        }
    }
}
