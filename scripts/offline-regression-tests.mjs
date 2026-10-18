import fs from "node:fs";
import assert from "node:assert/strict";

const sw = fs.readFileSync("public/sw.js", "utf8");

assert.match(sw, /const CACHE_PREFIX = "polo-umpire-assistant-"/);
assert.ok(sw.includes('const OFFLINE_INDEX = "/__polo-umpire-offline-index.json";'));
assert.match(sw, /REPAIR_OFFLINE/);
assert.match(sw, /keepCurrentAndPreviousCache/);
assert.match(sw, /Atomic cutover/);
assert.match(sw, /shellAssetPaths/);
assert.match(sw, /registration|WARM_CACHE|OFFLINE_STATUS/);

const activateStart = sw.indexOf('self.addEventListener("activate"');
const activateEnd = sw.indexOf('self.addEventListener("message"', activateStart);
assert.ok(activateStart >= 0 && activateEnd > activateStart, "activate handler must exist");
const activateBlock = sw.slice(activateStart, activateEnd);
assert.equal(activateBlock.includes("caches.delete"), false, "activate must not delete the previous verified package");

const shellPut = sw.indexOf('await cache.put("/", shellResponse.clone())');
const missingCheck = sw.indexOf("missingBeforeShell");
assert.ok(shellPut > missingCheck, "HTML shell must be cached only after dependent assets are verified");

const installStart = sw.indexOf('self.addEventListener("install"');
const installEnd = sw.indexOf('self.addEventListener("activate"', installStart);
const installBlock = sw.slice(installStart, installEnd);
assert.match(installBlock, /INSTALL_CORE/);
assert.equal(installBlock.includes('cache.addAll(PACKAGE_CORE)'), false, "install must not expose the new HTML shell early");

for (const path of [
  "/data/manifest.json",
  "/data/rules-2026.json",
  "/data/resources-2026.json",
]) {
  assert.ok(sw.includes(path), "offline core is missing " + path);
}

console.log("Offline durability regression suite: passed.");
