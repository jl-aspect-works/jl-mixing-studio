import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const version = readFileSync("VERSION", "utf8").trim();
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (!semver.test(version)) {
  throw new Error(`VERSION is not supported SemVer: ${version}`);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
packageJson.version = version;
writeJson("package.json", packageJson);

const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
packageLock.version = version;
if (!packageLock.packages?.[""]) {
  throw new Error("package-lock.json is missing the root package entry");
}
packageLock.packages[""].version = version;
writeJson("package-lock.json", packageLock);

const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
tauriConfig.version = version;
writeJson("src-tauri/tauri.conf.json", tauriConfig);

const cargoTomlPath = "src-tauri/Cargo.toml";
const cargoToml = readFileSync(cargoTomlPath, "utf8");
const nextCargoToml = cargoToml.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m,
  `$1${version}$2`,
);
if (nextCargoToml === cargoToml && !cargoToml.includes(`version = "${version}"`)) {
  throw new Error("Could not update package version in src-tauri/Cargo.toml");
}
writeFileSync(cargoTomlPath, nextCargoToml);

const cargoLockPath = "src-tauri/Cargo.lock";
const cargoLock = readFileSync(cargoLockPath, "utf8");
const packagePattern = /(\[\[package\]\]\nname = "jl-mixing-studio"\nversion = ")[^"]+("\n)/;
if (!packagePattern.test(cargoLock)) {
  throw new Error("Could not find jl-mixing-studio package in src-tauri/Cargo.lock");
}
writeFileSync(cargoLockPath, cargoLock.replace(packagePattern, `$1${version}$2`));

process.stdout.write(`Synchronized Studio manifests to ${version}.\n`);
