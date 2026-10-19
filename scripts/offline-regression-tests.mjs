import fs from "node:fs";
import assert from "node:assert/strict";

const sw = fs.readFileSync("public/sw.js", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const rowHelper = fs.readFileSync("components/RowEntitlementHelper.tsx", "utf8");
const appVersion = fs.readFileSync("lib/app-version.ts", "utf8");

assert.match(sw, /const CACHE_PREFIX = "polo-umpire-assistant-"/);
assert.ok(sw.includes('const CACHE = "polo-umpire-assistant-v0.27.1-r3-2026";'));
assert.ok(appVersion.includes('APP_VERSION = "0.27.1"'));
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


assert.match(css, /html\s*\{[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /body\s*\{[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /\.appShell\s*\{[\s\S]*overflow-x:\s*clip/);
assert.match(rowHelper, /window\.scrollTo\(\{ left: 0, top: window\.scrollY/);

console.log("iOS viewport regression checks: passed.");
