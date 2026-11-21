// Verify exactly what the updater will use, with the public key shipped in the app.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const releaseDir = process.argv[2] ?? "release";
const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const manifest = JSON.parse(readFileSync(join(releaseDir, "latest.json"), "utf8"));
assert.equal(manifest.version, config.version);

const packages = readdirSync(releaseDir);
const suffixes = {
  "windows-x86_64": "-setup.exe",
  "darwin-aarch64": ".app.tar.gz",
  "darwin-x86_64": ".app.tar.gz",
  "linux-x86_64": ".AppImage",
};
assert.deepEqual(Object.keys(manifest.platforms).sort(), Object.keys(suffixes).sort());

const staging = mkdtempSync(join(tmpdir(), "vnmail-update-check-"));
try {
  const publicKey = join(staging, "update.pub");
  const signature = join(staging, "update.minisig");
  writeFileSync(publicKey, Buffer.from(config.plugins.updater.pubkey, "base64"));

  function verify(artifact) {
    const result = spawnSync("minisign", ["-V", "-p", publicKey, "-x", signature, "-m", artifact], { encoding: "utf8" });
    if (result.error) throw result.error;
    assert.notEqual(result.status, null, "minisign exited without a status");
    return result;
  }

  for (const [platform, suffix] of Object.entries(suffixes)) {
    const matches = packages.filter((file) => file.endsWith(suffix));
    assert.equal(matches.length, 1, `expected one package for ${platform}`);
    const [file] = matches;
    const artifact = join(releaseDir, file);
    const entry = manifest.platforms[platform];
    const asset = encodeURIComponent(file.replaceAll(" ", "."));
    assert.equal(entry.url, `https://github.com/protungtq/vn-mail/releases/download/v${manifest.version}/${asset}`);
    writeFileSync(signature, Buffer.from(entry.signature, "base64"));
    const valid = verify(artifact);
    assert.equal(valid.status, 0, `signature check failed for ${platform}: ${valid.stderr}`);
    console.log(`Verified the updater signature for ${platform}`);

    if (platform === "windows-x86_64") {
      const modified = join(staging, "modified.exe");
      copyFileSync(artifact, modified);
      appendFileSync(modified, "\n");
      assert.notEqual(verify(modified).status, 0, "the verifier accepted a modified update");
      console.log("Rejected a modified copy of the Windows update");
    }
  }
} finally {
  rmSync(staging, { recursive: true });
}
