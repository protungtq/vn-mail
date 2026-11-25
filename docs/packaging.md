# Packaging VN Mail

VN Mail is published as a GitHub Release. There is no package repository,
but a new version is more than the files on the release page: the Release
workflow also signs the updater manifest (`latest.json`, minisign), so the
app offers the new version in-app (Settings → About → Check now) and
installs it after checking the signature. Updates have worked in-app since
0.1.15.

## Cutting a release

1. Bump the version in `src-tauri/tauri.conf.json` and commit it on `main`.
2. Push a tag with the same version: `git tag v0.1.17 && git push origin v0.1.17`.
3. The `Release` workflow (`.github/workflows/release.yml`) builds the Linux
   packages (.deb, .rpm, .AppImage), the Windows installer (.exe, NSIS) and
   the macOS disk image (.dmg, universal) plus an .app.tar.gz, signs the
   updatable packages (.exe, .app.tar.gz, .AppImage) and writes the signed
   `latest.json`, writes one SHA256SUMS over every file, checks every file
   against its SHA-256 sum, and creates the GitHub Release with all of
   them attached. The tag must match the version in `tauri.conf.json`, or the
   Linux job refuses to run.
4. Check the release page, then announce the new version where users look.

The .dmg and the system packages (.deb, .rpm) are for manual download, so
they are not signed for the updater and are not listed in `latest.json`.

## Trial builds

The `macOS and Windows builds` workflow (`.github/workflows/desktop.yml`)
builds unsigned trial installers for macOS and Windows from any branch, on
demand from the Actions tab. Its artifacts are for testing only; releases
come from tags as above.

## Linux packages

The .deb and .rpm are built from the template in `src-tauri/vnmail.desktop`.
Installing the .deb adds VN Mail to the applications menu for all users.
