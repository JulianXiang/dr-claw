#!/usr/bin/env node
/**
 * Auto-install Python CLI tools needed by research-news scripts.
 *
 * Installs twitter-cli and xiaohongshu-cli via `uv tool install` (preferred)
 * or `pipx install` (fallback). Failures are non-fatal — the tools will
 * attempt auto-install again at runtime if needed.
 */

import { execFileSync } from "child_process";

const TOOLS = [
  { pkg: "twitter-cli", bin: "twitter" },
  { pkg: "xiaohongshu-cli", bin: "xhs" },
];

function which(cmd) {
  try {
    return execFileSync("which", [cmd], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function install(pkg, installer) {
  const args =
    installer === "uv"
      ? ["tool", "install", pkg]
      : ["install", pkg];
  try {
    execFileSync(installer, args, {
      stdio: "pipe",
      timeout: 120_000,
    });
    return true;
  } catch {
    return false;
  }
}

const installer = which("uv") ? "uv" : which("pipx") ? "pipx" : null;

if (!installer) {
  console.log(
    "[postinstall] Neither uv nor pipx found — skipping Python CLI tools. " +
      "Install them later with: uv tool install twitter-cli xiaohongshu-cli",
  );
  process.exit(0);
}

for (const { pkg, bin } of TOOLS) {
  if (which(bin)) {
    console.log(`[postinstall] ${bin} already installed, skipping.`);
    continue;
  }
  console.log(`[postinstall] Installing ${pkg} via ${installer}...`);
  if (install(pkg, installer)) {
    console.log(`[postinstall] ${pkg} installed successfully.`);
  } else {
    console.warn(
      `[postinstall] Failed to install ${pkg}. You can install it manually: ${installer === "uv" ? "uv tool install" : "pipx install"} ${pkg}`,
    );
  }
}
