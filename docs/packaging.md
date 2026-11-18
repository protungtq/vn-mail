# Packaging VN Mail

VN Mail is published as a GitHub Release. There is no package repository, no
update server and no signing key: a new version is just the files on the
release page.

## Cutting a release

1. Bump the version in `src-tauri/tauri.conf.json` and commit it on `main`.
2. Push a tag with the same version: `git tag v0.1.13 && git push origin v0.1.13`.
3. The `Release` workflow (`.github/workflows/release.yml`) builds the Linux
   packages (.deb, .rpm, .AppImage), the Windows installer (.exe, NSIS) and
   the macOS disk image (.dmg, universal) plus an .app.tar.gz, checks every
   file against its SHA-256 sum, and creates the GitHub Release with all of
   them attached. The tag must match the version in `tauri.conf.json`, or the
   Linux job refuses to run.
4. Check the release page, then announce the new version where users look.

## Trial builds

The `macOS and Windows builds` workflow (`.github/workflows/desktop.yml`)
builds unsigned trial installers for macOS and Windows from any branch, on
demand from the Actions tab. Its artifacts are for testing only; releases
come from tags as above.

## Linux packages

The .deb and .rpm are built from the template in `src-tauri/vnmail.desktop`.
Installing the .deb adds VN Mail to the applications menu for all users.
