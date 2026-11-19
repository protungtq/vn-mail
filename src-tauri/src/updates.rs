//! Knowing when a newer VN Mail exists, and fetching it for the user to install.
//!
//! The check reads the newest public release on GitHub: no update server, no
//! signing key. When a newer version exists, the app downloads the installer
//! for this computer, checks it against the release's SHA-256 list, opens it
//! and quits, so the installer can replace VN Mail. Installing itself is then
//! up to the user, like any download.
//!
//! What happens next depends on how VN Mail was installed:
//! - apt or dnf: the system's own updates install it; the app only says so.
//! - AppImage, Windows, macOS: the app downloads the installer (see above).
//! - anything else (run from a build folder): a link to the download page.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;

use crate::error::{Error, Result};

/// The newest public release of VN Mail on GitHub.
const RELEASES: &str = "https://api.github.com/repos/protungtq/vn-mail/releases/latest";

/// What the interface shows when a newer version exists.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Available {
    pub version: String,
    /// One line about the release, or empty.
    pub notes: String,
    /// "system" (apt or dnf installs it), "install" (the app downloads it) or "download" (the download page).
    pub how: &'static str,
    /// How this copy was installed: "deb", "rpm", "appimage", "dmg", "exe" or "other".
    pub package: String,
    /// The installer to download, or empty when the download page is the way.
    pub download_url: String,
    /// The file the installer is saved as.
    pub file_name: String,
    /// The release's SHA-256 list, for checking the download.
    pub sums_url: String,
}

/// One release from the GitHub API, with only the fields the check reads.
#[derive(Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// The three numbers of a version such as "0.1.4"; None for anything else.
fn numbers(version: &str) -> Option<(u32, u32, u32)> {
    let mut parts = version.trim().trim_start_matches('v').split('.').map(|p| p.parse::<u32>().ok());
    let version = (parts.next()??, parts.next()??, parts.next()??);
    parts.next().is_none().then_some(version)
}

/// True when `latest` is a later version than `current`.
pub fn newer(latest: &str, current: &str) -> bool {
    matches!((numbers(latest), numbers(current)), (Some(l), Some(c)) if l > c)
}

/// How an installation of this kind gets a new version.
pub fn how(package: &str) -> &'static str {
    match package {
        "deb" | "rpm" => "system",
        "appimage" | "dmg" | "exe" => "install",
        _ => "download",
    }
}

/// The installer file for this kind of installation, by file name.
fn installer_suffix(package: &str) -> Option<&'static str> {
    match package {
        "exe" => Some("-setup.exe"),
        "dmg" => Some(".dmg"),
        "appimage" => Some(".AppImage"),
        "deb" => Some(".deb"),
        "rpm" => Some(".rpm"),
        _ => None,
    }
}

/// The first line of the release notes, cut to what is shown.
fn first_line(body: &str) -> String {
    body.lines()
        .map(|line| line.trim().trim_start_matches(['#', '-', ' ']).trim())
        .find(|line| !line.is_empty())
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(300)
        .collect()
}

/// Turn a release into what the interface shows, or None when this version is current.
fn parse_release(release: &Release, current: &str, package: &str) -> Option<Available> {
    let version = release.tag_name.trim().trim_start_matches('v').to_string();
    if !newer(&version, current) {
        return None;
    }
    let notes = first_line(release.body.as_deref().unwrap_or_default());
    let sums_url = release
        .assets
        .iter()
        .find(|a| a.name == "SHA256SUMS")
        .map(|a| a.browser_download_url.clone())
        .unwrap_or_default();
    let installer = installer_suffix(package)
        .and_then(|suffix| release.assets.iter().find(|a| a.name.ends_with(suffix)));
    let (download_url, file_name) = match installer {
        Some(asset) => (asset.browser_download_url.clone(), asset.name.clone()),
        None => (String::new(), String::new()),
    };
    Some(Available { version, notes, how: how(package), package: package.to_string(), download_url, file_name, sums_url })
}

/// Ask GitHub whether a newer version exists. None when this one is current.
pub async fn check(current: &str) -> Result<Option<Available>> {
    let package = crate::stats::package_kind();
    let client = reqwest::Client::builder()
        .user_agent("VN Mail")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| Error(format!("Could not check for a newer version: {e}")))?;
    let release: Release = client
        .get(RELEASES)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| Error(format!("Could not reach GitHub to check for a newer version: {e}")))?
        .error_for_status()
        .map_err(|e| Error(format!("GitHub did not answer the version check: {e}")))?
        .json()
        .await
        .map_err(|e| Error(format!("GitHub's answer could not be read: {e}")))?;
    Ok(parse_release(&release, current, &package))
}

/// The hash listed for `file` in a `sha256sum` list, if any. The file name
/// itself can hold spaces, so only the first gap separates hash from name.
fn expected_hash(sums: &str, file: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let (hash, rest) = line.split_once(char::is_whitespace)?;
        let name = rest.trim_start().trim_start_matches('*');
        (name == file).then(|| hash.to_lowercase())
    })
}

/// Download the installer, check it against the release's SHA-256 list and
/// return where it was saved. The file goes to Downloads, where the user can
/// find it again.
pub async fn download(app: &AppHandle, found: &Available) -> Result<PathBuf> {
    if found.download_url.is_empty() || found.file_name.is_empty() {
        return Err(Error("There is no installer file for this computer in the newest release.".into()));
    }
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().temp_dir())
        .map_err(|e| Error(format!("Could not find a folder for the download: {e}")))?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| Error(format!("Could not make a folder for the download: {e}")))?;
    let path = dir.join(&found.file_name);
    let client = reqwest::Client::builder()
        .user_agent("VN Mail")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| Error(format!("Could not download the new version: {e}")))?;
    let response = client
        .get(&found.download_url)
        .send()
        .await
        .map_err(|e| Error(format!("Could not download the new version: {e}")))?
        .error_for_status()
        .map_err(|e| Error(format!("The download did not start: {e}")))?;
    // One whole file in memory: the installers are a few megabytes.
    let bytes = response
        .bytes()
        .await
        .map_err(|e| Error(format!("The download stopped halfway: {e}")))?;
    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| Error(format!("Could not save the download: {e}")))?;
    file.write_all(&bytes)
        .await
        .map_err(|e| Error(format!("Could not save the download: {e}")))?;
    file.flush().await.map_err(|e| Error(format!("Could not save the download: {e}")))?;
    drop(file);
    let hash = Sha256::digest(&bytes);
    if found.sums_url.is_empty() {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(Error("The newest release has no checksum list, so the download was not trusted.".into()));
    }
    let sums = client
        .get(&found.sums_url)
        .send()
        .await
        .map_err(|e| Error(format!("Could not read the checksum list: {e}")))?
        .error_for_status()
        .map_err(|e| Error(format!("Could not read the checksum list: {e}")))?
        .text()
        .await
        .map_err(|e| Error(format!("Could not read the checksum list: {e}")))?;
    let want = expected_hash(&sums, &found.file_name)
        .ok_or_else(|| Error("The newest release has no checksum for its installer, so the download was not trusted.".into()))?;
    let got: String = hash.iter().map(|b| format!("{b:02x}")).collect();
    if got != want {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(Error("The download does not match its checksum, so it was deleted.".into()));
    }
    Ok(path)
}

/// Open the downloaded installer, so the system installs it.
pub fn open(app: &AppHandle, path: &Path) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
    }
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| Error(format!("The installer could not be opened: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(json: &str) -> Release {
        serde_json::from_str(json).expect("the test release is valid JSON")
    }

    #[test]
    fn compares_versions_by_number() {
        assert!(newer("0.1.4", "0.1.3"));
        assert!(newer("0.2.0", "0.1.99"));
        assert!(newer("v1.0.0", "0.9.9"));
        assert!(newer("0.1.10", "0.1.9"), "not as text");
        for (latest, current) in [("0.1.3", "0.1.3"), ("0.1.2", "0.1.3"), ("", "0.1.3"), ("latest", "0.1.3"), ("0.1", "0.1.3"), ("0.1.4.1", "0.1.3"), ("0.1.4-beta", "0.1.3")] {
            assert!(!newer(latest, current), "{latest} vs {current}");
        }
    }

    #[test]
    fn each_kind_of_installation_updates_its_own_way() {
        assert_eq!(how("deb"), "system");
        assert_eq!(how("rpm"), "system");
        assert_eq!(how("appimage"), "install");
        assert_eq!(how("exe"), "install");
        assert_eq!(how("dmg"), "install");
        assert_eq!(how("other"), "download");
    }

    #[test]
    fn reads_the_newest_release() {
        let found = parse_release(
            &release(r#"{"tag_name":"v0.1.14","body":"## What's new\n\n- Faster search.\n- More.","assets":[{"name":"VN Mail_0.1.14_x64-setup.exe","browser_download_url":"https://example.com/setup.exe"},{"name":"SHA256SUMS","browser_download_url":"https://example.com/SHA256SUMS"}]}"#),
            "0.1.13",
            "exe",
        )
        .unwrap();
        assert_eq!(
            found,
            Available {
                version: "0.1.14".into(),
                notes: "What's new".into(),
                how: "install",
                package: "exe".into(),
                download_url: "https://example.com/setup.exe".into(),
                file_name: "VN Mail_0.1.14_x64-setup.exe".into(),
                sums_url: "https://example.com/SHA256SUMS".into(),
            }
        );
        let same = parse_release(&release(r#"{"tag_name":"v0.1.13","body":"","assets":[]}"#), "0.1.13", "exe");
        assert!(same.is_none(), "already current");
        let no_installer = parse_release(
            &release(r#"{"tag_name":"v0.1.14","body":"","assets":[{"name":"SHA256SUMS","browser_download_url":"https://example.com/SHA256SUMS"}]}"#),
            "0.1.13",
            "exe",
        )
        .unwrap();
        assert_eq!(no_installer.how, "install", "the kind still decides the way");
        assert!(no_installer.download_url.is_empty(), "no installer file in the release");
        let system = parse_release(
            &release(r#"{"tag_name":"v0.1.14","body":"","assets":[{"name":"vnmail_0.1.14_amd64.deb","browser_download_url":"https://example.com/vnmail.deb"}]}"#),
            "0.1.13",
            "deb",
        )
        .unwrap();
        assert_eq!(system.how, "system");
        assert_eq!(system.file_name, "vnmail_0.1.14_amd64.deb");
    }

    #[test]
    fn checks_the_checksum_list() {
        let sums = "98c536e03c72ea23c5764786eb56a743cf1a603059197ef1b484200653f83ca2  VN Mail_0.1.13_x64-setup.exe\nabcdef  *other.bin\n";
        assert_eq!(
            expected_hash(sums, "VN Mail_0.1.13_x64-setup.exe").as_deref(),
            Some("98c536e03c72ea23c5764786eb56a743cf1a603059197ef1b484200653f83ca2")
        );
        assert_eq!(expected_hash(sums, "other.bin").as_deref(), Some("abcdef"), "the star is not part of the name");
        assert!(expected_hash(sums, "missing.exe").is_none());
        assert!(expected_hash("not a list", "x").is_none());
    }
}
