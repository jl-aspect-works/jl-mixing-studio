// Windows canonical paths are safe for filesystem access but not necessarily for
// the Shell. Convert only at the OS boundary, after project containment checks.
fn shell_path_units(path: &[u16]) -> Result<Vec<u16>, String> {
    if path.contains(&0) {
        return Err("The selected path contains a null character".into());
    }
    let unc_prefix: Vec<u16> = r"\\?\UNC\".encode_utf16().collect();
    let verbatim_prefix: Vec<u16> = r"\\?\".encode_utf16().collect();
    let mut result = if let Some(rest) = path.strip_prefix(unc_prefix.as_slice()) {
        let mut unc: Vec<u16> = r"\\".encode_utf16().collect();
        unc.extend_from_slice(rest);
        unc
    } else if let Some(rest) = path.strip_prefix(verbatim_prefix.as_slice()) {
        let is_drive = rest.len() >= 3
            && ((b'A' as u16..=b'Z' as u16).contains(&rest[0])
                || (b'a' as u16..=b'z' as u16).contains(&rest[0]))
            && rest[1] == b':' as u16
            && rest[2] == b'\\' as u16;
        if !is_drive {
            return Err("This Windows path type cannot be revealed in File Explorer".into());
        }
        rest.to_vec()
    } else {
        path.to_vec()
    };
    result.push(0);
    Ok(result)
}

#[cfg(windows)]
pub(super) fn reveal(path: &std::path::Path) -> Result<(), String> {
    native::reveal(path)
}

#[cfg(windows)]
mod native {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use windows::core::{Error, PCWSTR};
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::Com::{
        CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::Common::ITEMIDLIST;
    use windows::Win32::UI::Shell::{SHOpenFolderAndSelectItems, SHParseDisplayName};

    pub(super) fn reveal(path: &Path) -> Result<(), String> {
        let _apartment = ShellApartment::initialize()?;
        let item = ShellItem::parse(path)?;
        // With no child array, the absolute PIDL selects this file OR folder in
        // its parent. No file name is interpreted as command-line syntax.
        unsafe { SHOpenFolderAndSelectItems(item.0, None, 0) }
            .map_err(|error| shell_error("select the item", error))
    }

    struct ShellApartment(bool);

    impl ShellApartment {
        fn initialize() -> Result<Self, String> {
            // A blocking worker may already have COM initialized in another
            // mode. Reuse it, without balancing an initialization we did not own.
            let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            if result.is_ok() {
                Ok(Self(true))
            } else if result == RPC_E_CHANGED_MODE {
                Ok(Self(false))
            } else {
                Err(shell_error(
                    "initialize Windows Shell",
                    Error::from_hresult(result),
                ))
            }
        }
    }

    impl Drop for ShellApartment {
        fn drop(&mut self) {
            if self.0 {
                // Includes S_FALSE: each successful COM initialization is balanced.
                unsafe { CoUninitialize() };
            }
        }
    }

    struct ShellItem(*mut ITEMIDLIST);

    impl ShellItem {
        fn parse(path: &Path) -> Result<Self, String> {
            let units: Vec<u16> = path.as_os_str().encode_wide().collect();
            let shell_path = super::shell_path_units(&units)?;
            let mut item = std::ptr::null_mut();
            // The buffer is nul-terminated and lives through the call. The Shell
            // allocates the PIDL; this guard frees it before COM is uninitialized.
            unsafe { SHParseDisplayName(PCWSTR(shell_path.as_ptr()), None, &mut item, 0, None) }
                .map_err(|error| shell_error("resolve the item", error))?;
            if item.is_null() {
                return Err("Windows Shell returned no item for the selected path".into());
            }
            Ok(Self(item))
        }
    }

    impl Drop for ShellItem {
        fn drop(&mut self) {
            unsafe { CoTaskMemFree(Some(self.0.cast())) };
        }
    }

    fn shell_error(action: &str, error: Error) -> String {
        format!(
            "Unable to {action} in File Explorer: {error}. Check that the file or folder and its drive or network share are available, then try Reveal again."
        )
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn resolves_canonical_files_and_folders_without_launching_explorer() {
            let temp = tempfile::tempdir().expect("test directory");
            let folder = temp.path().join("Folder, with spaces & café");
            std::fs::create_dir(&folder).expect("create folder");
            let file = folder.join("Take 01, piano & vocal.wav");
            std::fs::write(&file, b"audio").expect("create file");
            let _apartment = ShellApartment::initialize().expect("initialize COM");
            for path in [&folder, &file] {
                let canonical = path.canonicalize().expect("canonical path");
                let _item = ShellItem::parse(&canonical).expect("resolve shell item");
            }
            assert!(ShellItem::parse(&folder.join("missing.wav")).is_err());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::shell_path_units;

    #[test]
    fn preserves_drive_and_unc_targets_with_shell_punctuation_and_unicode() {
        for (source, expected) in [
            (
                r"\\?\C:\Mixes\Take 01, café & vocal.wav",
                r"C:\Mixes\Take 01, café & vocal.wav",
            ),
            (
                r"\\?\UNC\nas-lev-02\media\Mixes\Folder, one",
                r"\\nas-lev-02\media\Mixes\Folder, one",
            ),
            (r"C:\Mixes\Folder one", r"C:\Mixes\Folder one"),
            (
                r"\\nas-lev-02\media\Mixes\Take 01.wav",
                r"\\nas-lev-02\media\Mixes\Take 01.wav",
            ),
        ] {
            let source: Vec<u16> = source.encode_utf16().collect();
            let expected: Vec<u16> = expected.encode_utf16().chain(Some(0)).collect();
            assert_eq!(shell_path_units(&source).expect("shell path"), expected);
        }
    }

    #[test]
    fn preserves_non_unicode_windows_names_without_lossy_replacement() {
        let source = [b'C' as u16, b':' as u16, b'\\' as u16, 0xD800];
        let mut expected = source.to_vec();
        expected.push(0);
        assert_eq!(shell_path_units(&source).expect("shell path"), expected);
    }

    #[test]
    fn rejects_embedded_nulls_and_unsupported_verbatim_devices() {
        assert!(shell_path_units(&[b'C' as u16, 0, b'X' as u16]).is_err());
        let device: Vec<u16> = r"\\?\GLOBALROOT\Device\HarddiskVolume1"
            .encode_utf16()
            .collect();
        assert!(shell_path_units(&device).is_err());
    }
}
