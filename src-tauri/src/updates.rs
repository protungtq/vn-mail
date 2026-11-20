//! Knowing when a newer VN Mail exists, and installing it where the app can.
//!
//! Each release publishes one small public file, `latest.json`, with the
//! newest version and a signature for every installer. The check below reads
//! that file; when a newer version exists, the app installs it itself through
//! the Tauri updater plugin, which refuses any file whose signature was not
//! made with the update key — the public half of that key is built into the
//! app (tauri.conf.json).
//!
//! What happens next depends on how VN Mail was installed:
//! - apt or dnf: the system's own updates install it; the app only says so.
//! - AppImage, Windows, macOS: the app downloads and installs the update
//!   itself, then starts the new version.
//! - anything else (run from a build folder): a link to the download page.

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// The newest release's version file, served as a GitHub release asset.
pub const MANIFEST: &str = "https://github.com/protungtq/vn-mail/releases/latest/download/latest.json";

/// What the interface shows when a newer version exists.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Available {
    pub version: String,
    /// One line about the release, or empty.
    pub notes: String,
    /// "system" (apt or dnf installs it), "install" (the app can) or "download" (the download page).
    pub how: &'static str,
    /// How it was installed: "deb", "rpm", "appimage", "dmg", "exe" or "other".
    pub package: String,
}

#[derive(Deserialize)]
struct Manifest {
    version: String,
    #[serde(default)]
    notes: String,
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

/// Read the version file. The text comes from the internet, so it is cut to what is shown.
fn read(body: &str, current: &str, package: &str) -> Option<Available> {
    let manifest: Manifest = serde_json::from_str(body).ok()?;
    if !newer(&manifest.version, current) {
        return None;
    }
    let notes: String = manifest.notes.chars().filter(|c| !c.is_control()).take(300).collect();
    Some(Available { version: manifest.version.trim().trim_start_matches('v').to_string(), notes, how: how(package), package: package.to_string() })
}

/// Ask whether a newer version exists. None when this one is current.
pub async fn check(current: &str) -> Result<Option<Available>> {
    let package = crate::stats::package_kind();
    let client = reqwest::Client::builder()
        .user_agent("VN Mail")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| Error(format!("Could not check for a newer version: {e}")))?;
    let body = client
        .get(MANIFEST)
        .send()
        .await
        .map_err(|e| Error(format!("Could not reach the update server to check for a newer version: {e}")))?
        .error_for_status()
        .map_err(|e| Error(format!("The update server did not answer the version check: {e}")))?
        .text()
        .await
        .map_err(|e| Error(format!("The update server's answer could not be read: {e}")))?;
    Ok(read(&body, current, &package))
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn reads_the_version_file() {
        let found = read(r#"{"version":"0.2.0","notes":"Faster search.\nMore.","platforms":{}}"#, "0.1.3", "deb").unwrap();
        assert_eq!(found, Available { version: "0.2.0".into(), notes: "Faster search.More.".into(), how: "system", package: "deb".into() });
        assert!(read(r#"{"version":"0.1.3"}"#, "0.1.3", "deb").is_none(), "already current");
        assert!(read("not json", "0.1.3", "deb").is_none());
        assert_eq!(read(&format!(r#"{{"version":"9.0.0","notes":"{}"}}"#, "x".repeat(900)), "0.1.3", "exe").unwrap().notes.len(), 300);
    }
}
