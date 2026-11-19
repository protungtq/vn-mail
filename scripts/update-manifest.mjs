// Writes release/latest.json: the file the in-app updater checks.
//
// Run by the Release workflow after the updatable packages were signed:
//   node scripts/update-manifest.mjs v0.1.14
//
// Each platform entry holds the download link and the signature of its file,
// so the app can check the download against VN Mail's update key before it
// installs anything. The .dmg and the system packages are for manual
// download and are not listed here.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error("usage: node scripts/update-manifest.mjs <tag such as v0.1.14>");
  process.exit(1);
}
const version = tag.slice(1);
const base = `https://github.com/protungtq/vn-mail/releases/download/${tag}`;
const files = readdirSync("release");

function find(suffix) {
  const found = files.filter((f) => f.endsWith(suffix));
  if (found.length !== 1) {
    throw new Error(`expected exactly one ${suffix} file in release/, found ${found.length}`);
  }
  return found[0];
}

// The .sig file holds the signature, possibly with minisign comment lines.
function signature(file) {
  const text = readFileSync(`release/${file}.sig`, "utf8");
  const sig = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("untrusted comment") && !line.startsWith("trusted comment"))
    .join("");
  if (!sig) {
    throw new Error(`no signature in release/${file}.sig`);
  }
  return sig;
}

function entry(file) {
  return { signature: signature(file), url: `${base}/${encodeURIComponent(file)}` };
}

const exe = find("-setup.exe");
const archive = find(".app.tar.gz");
const appimage = find(".AppImage");
const platforms = {
  "windows-x86_64": entry(exe),
  // One universal app archive serves both kinds of Mac.
  "darwin-aarch64": entry(archive),
  "darwin-x86_64": entry(archive),
  "linux-x86_64": entry(appimage),
};

const manifest = { version, notes: "", pub_date: new Date().toISOString(), platforms };
writeFileSync("release/latest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
