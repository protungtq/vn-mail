//! The anonymous usage count: at most one small request a day, so the project
//! can see how many people use VN Mail without knowing who they are.
//!
//! Disabled in this fork: VN Mail has no usage-count server, so `enabled`
//! always answers false and nothing is ever sent. The code is kept so the
//! count can be switched on later by pointing ENDPOINT at a server.
//!
//! Nothing is sent unless the user said yes to it. There is no install id.
//! The request says which version and kind of system it comes from, and
//! whether it is this installation's first request today, this week, this
//! month and ever; the server only adds those up. What was last sent is kept
//! in the local settings table, never on the server.
//!
//! The facts are kept coarse (the major system version, the month of
//! installation) so that few installations share none of them. On an uncommon
//! system the combination may still be shared by only a few, which is said
//! plainly in PRIVACY.md.

use chrono::{DateTime, Datelike, Utc};
use rusqlite::Connection;
use serde::Serialize;

use crate::db;
use crate::error::Result;

/// Where the count would be sent. Unused while `enabled` answers false.
pub const ENDPOINT: &str = "https://stats.openwren.app/ping";

/// Exactly what is sent. Field names are short because the server stores only counters.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Ping {
    /// App version, such as "0.1.0".
    pub v: String,
    /// How it was installed: "deb", "rpm", "appimage", "flatpak", "dmg" (macOS), "exe" (Windows) or "other".
    pub pkg: String,
    /// Distribution and major version, such as "ubuntu-24".
    pub os: String,
    /// Processor type, such as "x86_64".
    pub arch: String,
    /// First request today, this week, this month, ever.
    pub d: bool,
    pub w: bool,
    pub m: bool,
    pub first: bool,
    /// The month the app was first used, such as "2026-11". (The name is from when it was a week.)
    pub iw: String,
}

fn day(now: DateTime<Utc>) -> String {
    now.format("%Y-%m-%d").to_string()
}

fn week(now: DateTime<Utc>) -> String {
    let iso = now.iso_week();
    format!("{}-W{:02}", iso.year(), iso.week())
}

fn month(now: DateTime<Utc>) -> String {
    now.format("%Y-%m").to_string()
}

/// Always false in this fork: VN Mail has no usage-count server, so the ping
/// never runs. The setting is kept so the choice survives if counting returns.
pub fn enabled(_conn: &Connection) -> bool {
    false
}

/// False while the welcome screen of a new installation is still open. That screen asks
/// about the count, so nothing may be sent before the user has finished it. The interface
/// records "onboarded" when the screen is finished or skipped, and for an installation
/// that already had accounts before the screen existed.
pub fn welcomed(conn: &Connection) -> bool {
    db::get_setting(conn, "onboarded").ok().flatten().as_deref() == Some("yes")
}

/// The user's own choice, on the welcome screen or in Settings. Nothing is counted
/// until the user has said yes: not choosing means no.
pub fn switched_on(conn: &Connection) -> bool {
    db::get_setting(conn, "usage_stats").ok().flatten().as_deref() == Some("on")
}

/// Installations set up before the count became a choice had it on unless switched off,
/// and keep that: on their first start with this version, a setting never touched becomes
/// "on". A new installation answers on the welcome screen instead. Runs once.
pub fn keep_earlier_default(conn: &Connection) -> Result<()> {
    if db::get_setting(conn, "usage_choice_kept")?.is_some() {
        return Ok(());
    }
    let set_up = welcomed(conn) || !db::list_accounts(conn)?.is_empty();
    if set_up && db::get_setting(conn, "usage_stats")?.is_none() {
        db::set_setting(conn, "usage_stats", "on")?;
    }
    db::set_setting(conn, "usage_choice_kept", "yes")
}

/// The month of an install week stored by an older version ("2026-W46" → "2026-11"),
/// or the value itself when it is already a month.
fn as_month(stored: &str) -> Option<String> {
    let (year, week) = stored.split_once("-W")?;
    let monday = chrono::NaiveDate::from_isoywd_opt(year.parse().ok()?, week.parse().ok()?, chrono::Weekday::Mon)?;
    Some(monday.format("%Y-%m").to_string())
}

/// The request that would be sent now, or None when today's has already gone out.
pub fn next(conn: &Connection, now: DateTime<Utc>, version: &str) -> Result<Option<Ping>> {
    let last = |key: &str| db::get_setting(conn, key);
    if last("stats_last_day")?.as_deref() == Some(day(now).as_str()) {
        return Ok(None);
    }
    let install_month = last("stats_install_week")?.map(|stored| as_month(&stored).unwrap_or(stored));
    let (pkg, os) = system();
    Ok(Some(Ping {
        v: version.to_string(),
        pkg,
        os,
        arch: std::env::consts::ARCH.to_string(),
        d: true,
        w: last("stats_last_week")?.as_deref() != Some(week(now).as_str()),
        m: last("stats_last_month")?.as_deref() != Some(month(now).as_str()),
        first: install_month.is_none(),
        iw: install_month.unwrap_or_else(|| month(now)),
    }))
}

/// Remember that a request went out, so the next one carries the right flags.
pub fn record(conn: &Connection, ping: &Ping, now: DateTime<Utc>) -> Result<()> {
    db::set_setting(conn, "stats_last_day", &day(now))?;
    db::set_setting(conn, "stats_last_week", &week(now))?;
    db::set_setting(conn, "stats_last_month", &month(now))?;
    db::set_setting(conn, "stats_install_week", &ping.iw)
}

/// How this copy was installed: "deb", "rpm", "appimage", "flatpak", "dmg", "exe" or "other".
pub fn package_kind() -> String {
    system().0
}

/// (package kind, "distribution-version") of this computer, from `/etc/os-release`.
fn system() -> (String, String) {
    // macOS and Windows have one installer each and no distributions to tell apart.
    if cfg!(target_os = "macos") {
        return ("dmg".into(), "macos".into());
    }
    if cfg!(target_os = "windows") {
        return ("exe".into(), "windows".into());
    }
    let release = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let exe = std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    describe(&release, &exe, std::env::var_os("APPIMAGE").is_some(), std::path::Path::new("/.flatpak-info").exists())
}

fn describe(os_release: &str, exe: &str, appimage: bool, flatpak: bool) -> (String, String) {
    let field = |name: &str| {
        os_release
            .lines()
            .find_map(|line| line.strip_prefix(name)?.strip_prefix('='))
            .map(|value| value.trim().trim_matches('"').to_lowercase())
            .unwrap_or_default()
    };
    let clean = |text: String, allowed: fn(char) -> bool, max: usize| text.chars().filter(|c| allowed(*c)).take(max).collect::<String>();
    let id = clean(field("ID"), |c| c.is_ascii_alphanumeric() || c == '-', 24);
    // Only the major version ("24" of "24.04"): fewer installations stand out.
    let version = clean(field("VERSION_ID"), |c| c.is_ascii_digit() || c == '.', 8).split('.').next().unwrap_or_default().to_string();
    let os = match (id.is_empty(), version.is_empty()) {
        (true, _) => "other".to_string(),
        (false, true) => id.clone(),
        (false, false) => format!("{id}-{version}"),
    };
    let family = format!("{id} {}", field("ID_LIKE"));
    let pkg = if appimage {
        "appimage"
    } else if flatpak {
        "flatpak"
    } else if !exe.starts_with("/usr/") {
        "other" // run from a build folder or unpacked by hand
    } else if ["debian", "ubuntu"].iter().any(|f| family.contains(f)) {
        "deb"
    } else if ["fedora", "rhel", "suse", "centos"].iter().any(|f| family.contains(f)) {
        "rpm"
    } else {
        "other"
    };
    (pkg.to_string(), os)
}

/// Send one request. Failure is silent and simply tried again later.
pub async fn send(ping: &Ping) -> Result<()> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).user_agent("VN Mail").build()?;
    let response = client.post(ENDPOINT).json(ping).send().await?;
    if !response.status().is_success() {
        return Err(crate::error::Error(format!("The usage counter answered {}.", response.status())));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(y: i32, m: u32, d: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, 9, 30, 0).unwrap()
    }

    #[test]
    fn one_request_a_day_with_the_right_first_flags() {
        let conn = crate::store::open_in_memory().unwrap();
        // First ever: everything is a first.
        let friday = at(2026, 11, 13);
        let first = next(&conn, friday, "0.1.0").unwrap().unwrap();
        assert_eq!((first.d, first.w, first.m, first.first), (true, true, true, true));
        assert_eq!(first.iw, "2026-11", "the month of installation, not the week");
        assert_eq!(first.v, "0.1.0");
        record(&conn, &first, friday).unwrap();

        // Same day: nothing more is sent.
        assert_eq!(next(&conn, friday, "0.1.0").unwrap(), None);

        // Next day, same week and month.
        let saturday = at(2026, 11, 14);
        let second = next(&conn, saturday, "0.1.0").unwrap().unwrap();
        assert_eq!((second.d, second.w, second.m, second.first), (true, false, false, false));
        assert_eq!(second.iw, "2026-11", "the install month never changes");
        record(&conn, &second, saturday).unwrap();

        // Monday: a new week, same month.
        let monday = at(2026, 11, 16);
        let third = next(&conn, monday, "0.1.0").unwrap().unwrap();
        assert_eq!((third.w, third.m), (true, false));
        record(&conn, &third, monday).unwrap();

        // A missed stretch is not made up for: one request, with the flags of that day.
        let december = at(2026, 12, 3);
        let fourth = next(&conn, december, "0.2.0").unwrap().unwrap();
        assert_eq!((fourth.d, fourth.w, fourth.m, fourth.first), (true, true, true, false));
        assert_eq!(fourth.v, "0.2.0");
    }

    #[test]
    fn the_week_follows_the_iso_calendar_across_new_year() {
        assert_eq!(week(at(2027, 1, 1)), "2026-W53");
        assert_eq!(week(at(2027, 1, 4)), "2027-W01");
    }

    #[test]
    fn counts_only_after_a_yes() {
        let conn = crate::store::open_in_memory().unwrap();
        assert!(!switched_on(&conn), "no choice made is no");
        db::set_setting(&conn, "usage_stats", "on").unwrap();
        assert!(switched_on(&conn));
        db::set_setting(&conn, "usage_stats", "off").unwrap();
        assert!(!switched_on(&conn));
        assert!(!enabled(&conn));
    }

    #[test]
    fn installations_from_before_the_choice_keep_their_setting() {
        // Set up with the old switch left on: stays counted.
        let old = crate::store::open_in_memory().unwrap();
        db::set_setting(&old, "onboarded", "yes").unwrap();
        keep_earlier_default(&old).unwrap();
        assert!(switched_on(&old));
        // Switched off before: stays off.
        let off = crate::store::open_in_memory().unwrap();
        db::insert_account(&off, "a@example.test", "A", "imap", &crate::model::AccountSettings::default()).unwrap();
        db::set_setting(&off, "usage_stats", "off").unwrap();
        keep_earlier_default(&off).unwrap();
        assert!(!switched_on(&off));
        // A new installation: nothing is set, and skipping the welcome screen later does not turn it on.
        let new = crate::store::open_in_memory().unwrap();
        keep_earlier_default(&new).unwrap();
        db::set_setting(&new, "onboarded", "yes").unwrap();
        keep_earlier_default(&new).unwrap();
        assert!(!switched_on(&new));
    }

    #[test]
    fn an_install_week_from_an_older_version_becomes_its_month() {
        let conn = crate::store::open_in_memory().unwrap();
        db::set_setting(&conn, "stats_install_week", "2026-W46").unwrap();
        let ping = next(&conn, at(2026, 12, 3), "0.2.0").unwrap().unwrap();
        assert_eq!((ping.iw.as_str(), ping.first), ("2026-11", false));
        // Week 1 of 2027 starts on Monday 4 January.
        assert_eq!(as_month("2027-W01").as_deref(), Some("2027-01"));
        assert_eq!(as_month("2026-W01").as_deref(), Some("2025-12"));
    }

    #[test]
    fn waits_until_the_welcome_screen_is_done() {
        let conn = crate::store::open_in_memory().unwrap();
        assert!(!welcomed(&conn));
        db::set_setting(&conn, "onboarded", "yes").unwrap();
        assert!(welcomed(&conn));
        // Adding an account is a step of the welcome screen, before the one that asks.
        let midway = crate::store::open_in_memory().unwrap();
        db::insert_account(&midway, "katy@example.test", "Katy", "imap", &crate::model::AccountSettings::default()).unwrap();
        assert!(!welcomed(&midway));
    }

    #[test]
    fn describes_the_system_without_anything_personal() {
        let ubuntu = "NAME=\"Ubuntu\"\nID=ubuntu\nID_LIKE=debian\nVERSION_ID=\"24.04\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n";
        assert_eq!(describe(ubuntu, "/usr/bin/openwren", false, false), ("deb".into(), "ubuntu-24".into()), "major version only");
        assert_eq!(describe(ubuntu, "/home/someone/build/openwren", false, false), ("other".into(), "ubuntu-24".into()));
        assert_eq!(describe(ubuntu, "/tmp/.mount_x/usr/bin/openwren", true, false).0, "appimage");
        let fedora = "ID=fedora\nVERSION_ID=41\n";
        assert_eq!(describe(fedora, "/usr/bin/openwren", false, false), ("rpm".into(), "fedora-41".into()));
        let arch = "ID=arch\nBUILD_ID=rolling\n";
        assert_eq!(describe(arch, "/usr/bin/openwren", false, false), ("other".into(), "arch".into()));
        assert_eq!(describe("", "/usr/bin/openwren", false, true), ("flatpak".into(), "other".into()));
        // A hand-edited file cannot smuggle text into the request.
        assert_eq!(describe("ID=\"my host; rm -rf\"\nVERSION_ID=\"1.2 beta\"\n", "/usr/bin/x", false, false).1, "myhostrm-rf-1");
    }
}
