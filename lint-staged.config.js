/**
 * lint-staged configuration.
 *
 * Design note on ESLint:
 *   Each package in this monorepo has its own eslint.config.* at its own root
 *   (e.g. apps/web uses Next.js flat config; packages may add their own).
 *   Running a single `eslint --fix` from the repo root would require a root-level
 *   eslint.config.*, which would conflict with package-local configs.
 *   To keep the hook robust and avoid false positives on files outside an eslint
 *   project, we run `eslint --fix` only when invoked from within the file's own
 *   package directory (via the function form below).  Files that do not belong to
 *   a package with a local config are skipped for ESLint but still formatted by
 *   Prettier.
 *
 *   Prettier runs last to guarantee consistent formatting regardless of any
 *   ESLint --fix output.
 */

import { resolve, dirname } from "path";
import { existsSync } from "fs";

/** Resolve the nearest eslint.config.* walking up from a file path. */
function findEslintConfig(filePath) {
  let dir = dirname(resolve(filePath));
  const root = resolve("/");
  while (dir !== root) {
    for (const name of [
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
    ]) {
      if (existsSync(resolve(dir, name))) {
        return dir;
      }
    }
    dir = dirname(dir);
  }
  return null;
}

/** Build per-file eslint commands grouped by their config directory. */
function eslintPerPackage(files) {
  const groups = new Map();
  for (const file of files) {
    const configDir = findEslintConfig(file);
    if (!configDir) continue; // no eslint config found — skip
    const existing = groups.get(configDir) ?? [];
    groups.set(configDir, [...existing, file]);
  }

  // Run eslint from the config directory so that ESLint 9 flat config
  // resolves `eslint.config.*` from the correct cwd (process.cwd()).
  // Absolute file paths are passed so they resolve correctly from that cwd.
  return [...groups.entries()].map(
    ([dir, groupFiles]) =>
      `sh -c 'cd "${dir}" && eslint --fix --no-warn-ignored ${groupFiles.map((f) => `"${f}"`).join(" ")}'`,
  );
}

/** @type {import('lint-staged').Config} */
const config = {
  // Code files: ESLint (per-package, robust) then Prettier (last, settles formatting)
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => [
    ...eslintPerPackage(files),
    `prettier --write ${files.map((f) => `"${f}"`).join(" ")}`,
  ],

  // Data / prose files: Prettier only
  "*.{json,md,yml,yaml,css}": (files) =>
    `prettier --write ${files.map((f) => `"${f}"`).join(" ")}`,
};

export default config;
