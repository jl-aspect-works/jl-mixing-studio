import { readFileSync } from "node:fs";
import process from "node:process";

function fail(message) {
  process.stderr.write(`Release version check failed: ${message}\n`);
  process.exit(1);
}

const version = readFileSync("VERSION", "utf8").trim();
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (!semver.test(version)) {
  fail(`VERSION "${version}" is not supported SemVer`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");
const cargoVersion = cargoToml.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1];
const cargoLockVersion = cargoLock.match(/\[\[package\]\]\nname = "jl-mixing-studio"\nversion = "([^"]+)"/)?.[1];

const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json root package", packageLock.packages?.[""]?.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", cargoVersion],
  ["src-tauri/Cargo.lock", cargoLockVersion],
]);

for (const [source, candidate] of versions) {
  if (candidate !== version) {
    fail(`${source} is ${candidate ?? "missing"}, expected VERSION ${version}; run npm run version:sync`);
  }
}

const tag = process.argv[2];
if (tag && tag !== `v${version}`) {
  fail(`tag "${tag}" does not match VERSION ${version}; expected v${version}`);
}

process.stdout.write(`Studio version metadata agrees with VERSION ${version}.\n`);
