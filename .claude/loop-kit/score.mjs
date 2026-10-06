// The scorer. Runs the locked checks and prints one number: score: X/Y.
// Karpathy's prepare.py equivalent. The loop may run this, never edit it.
// Usage: node score.mjs <feature>
//
// Works with any test runner that can write JUnit XML. Vitest, Jest (with jest-junit)
// and pytest are wired in below; to add another, the human edits runner().
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// split-bill.test.ts, test_split_bill.py, split_bill_test.py → "split-bill"
const isCheck = (n) => /^test_|[._](test|spec)\.[^.]+$/.test(n);
const featureOf = (n) =>
  n
    .replace(/^test_/, "")
    .replace(/([._](test|spec))?\.[^.]+$/, "")
    .replace(/_/g, "-");
const decode = (s) =>
  s.replace(
    /&(quot|amp|lt|gt|apos|#39);/g,
    (_, e) =>
      ({ quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", "#39": "'" })[e],
  );

const feature = process.argv[2];
const checksDir = join("checks", "approved");
const files = existsSync(checksDir)
  ? readdirSync(checksDir).filter(isCheck)
  : [];
const mine = files.find((n) => featureOf(n) === feature);
if (!feature || !mine) {
  console.log(
    `No approved checks for "${feature ?? ""}" in checks/approved/. Draft and approve checks first.`,
  );
  process.exit(1);
}

const pkg = existsSync("package.json")
  ? readFileSync("package.json", "utf8")
  : "";
const python = existsSync(".venv/bin/python")
  ? ".venv/bin/python"
  : process.platform === "win32"
    ? "python"
    : "python3";

// How to run one check file so it writes JUnit XML to `out`.
function runner(file, out) {
  if (file.endsWith(".py"))
    return {
      cmd: `${python} -m pytest "${file}" -q -p no:cacheprovider --junitxml="${out}"`,
    };
  if (pkg.includes('"vitest"'))
    return {
      cmd: `npx vitest run "${file}" --reporter=junit --outputFile="${out}"`,
    };
  if (pkg.includes('"jest"'))
    return {
      cmd: `npx jest "${file}" --reporters=jest-junit`,
      env: { JEST_JUNIT_OUTPUT_FILE: out },
    };
  return null;
}

mkdirSync(".scores", { recursive: true });

function run(name) {
  const file = join(checksDir, name);
  const out = join(".scores", `${name}.xml`);
  rmSync(out, { force: true });
  const r = runner(file, out);
  if (!r) {
    console.log(
      `No test runner for ${file}. Install vitest, jest + jest-junit, or pytest, or add one to runner() in score.mjs.`,
    );
    process.exit(1);
  }
  // Runners exit non-zero when anything fails; the XML still has the results.
  // NODE_ENV/DB_PATH let the app point itself at throwaway data while it's being scored.
  try {
    execSync(r.cmd, {
      stdio: "ignore",
      env: { ...process.env, NODE_ENV: "test", DB_PATH: ":memory:", ...r.env },
    });
  } catch {}
  const xml = existsSync(out) ? readFileSync(out, "utf8") : "";
  return [
    ...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g),
  ].map(([, attrs, body = ""]) => ({
    name: decode(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? "?"),
    ok: !/<(failure|error|skipped)\b/.test(body),
  }));
}

let passed = 0,
  total = 0,
  crashed = false;
const failing = [],
  otherFailing = [];

for (const name of files) {
  const results = run(name);
  if (name === mine) {
    crashed = results.length === 0;
    total = results.length;
    passed = results.filter((r) => r.ok).length;
    failing.push(...results.filter((r) => !r.ok).map((r) => r.name));
  } else {
    if (!results.length) otherFailing.push(`${name}: couldn't run`);
    for (const r of results) if (!r.ok) otherFailing.push(`${name}: ${r.name}`);
  }
}

// Other features' checks that were already failing when this feature started
// (e.g. one that hit the round cap) don't count. Only new breakage does.
const baseline = join(".scores", `${feature}.baseline.json`);
if (!existsSync(baseline))
  writeFileSync(baseline, JSON.stringify(otherFailing, null, 2));
const alreadyFailing = new Set(JSON.parse(readFileSync(baseline, "utf8")));
const brokeEarlier = otherFailing.filter((f) => !alreadyFailing.has(f));

if (crashed) {
  console.log(
    "crash: the checks couldn't run (usually a missing function, a bad import or a syntax error)",
  );
  console.log("score: 0/?");
  process.exit(0);
}
if (failing.length) console.log("still failing: " + failing.join("; "));
if (brokeEarlier.length) {
  console.log("broke an earlier feature: " + brokeEarlier.join("; "));
  passed = 0;
}
console.log(`score: ${passed}/${total}`);
