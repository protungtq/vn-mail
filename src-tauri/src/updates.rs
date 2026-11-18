//! Knowing when a newer VN Mail exists, and installing it where the app can.
//!
//! Each release would publish one small public file, `latest.json`, with the
//! newest version. VN Mail has no update server yet, so `check` always answers
//! "none" and the app never contacts one. The machinery below (version
//! comparison, the manifest format, the installer) is kept so updates can be
//! switched on later by pointing MANIFEST at a server and adding a signing key
//! to tauri.conf.json.
//!
//! What happens next depends on how VN Mail was installed:
//! - apt or dnf: the system's own updates install it; the app only says so.
//! - AppImage, Windows, macOS: the app can download and install the update itself.
//!   The update must carry a signature made with the update key, whose
//!   public half is built into the app (tauri.conf.json), or it is refused.
//! - anything else (run from a build folder): a link to the download page.

use serde::{Deserialize, Serialize};

use crate::error::Result;

pub const MANIFEST: &str = "https://so1.asia/vn-mail/latest.json";

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
#[allow(dead_code)]
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
/// Only used by tests while the update check is stubbed.
#[allow(dead_code)]
fn read(body: &str, current: &str, package: &str) -> Option<Available> {
    let manifest: Manifest = serde_json::from_str(body).ok()?;
    if !newer(&manifest.version, current) {
        return None;
    }
    let notes: String = manifest.notes.chars().filter(|c| !c.is_control()).take(300).collect();
    Some(Available { version: manifest.version.trim().trim_start_matches('v').to_string(), notes, how: how(package), package: package.to_string() })
}

/// Ask whether a newer version exists. None when this one is current.
///
/// VN Mail has no update server yet, so the answer is always none and nothing
/// is fetched. Point MANIFEST at a server to switch the check on again.
pub async fn check(_current: &str) -> Result<Option<Available>> {
    Ok(None)
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

    /// No update server yet: the check answers "none" without touching the network.
    #[tokio::test]
    async fn the_update_check_answers_none_without_a_server() {
        assert!(check("0.0.1").await.unwrap().is_none());
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
