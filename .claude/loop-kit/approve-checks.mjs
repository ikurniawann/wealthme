// Moves approved checks from checks/drafts/ into checks/approved/.
// Only ever adds: it refuses to replace an approved check.
// Usage from repository root: node .claude/loop-kit/approve-checks.mjs <feature> ...
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

// split-bill.test.ts, test_split_bill.py, split_bill_test.py → "split-bill"
const featureOf = (n) =>
  n
    .replace(/^test_/, "")
    .replace(/([._](test|spec))?\.[^.]+$/, "")
    .replace(/_/g, "-");
const draftsDir = join("checks", "drafts");
const approvedDir = join("checks", "approved");

mkdirSync(draftsDir, { recursive: true });
mkdirSync(approvedDir, { recursive: true });
const drafts = existsSync(draftsDir) ? readdirSync(draftsDir) : [];
const locked = readdirSync(approvedDir).map(featureOf);

for (const feature of process.argv.slice(2)) {
  const draft = drafts.find((n) => featureOf(n) === feature);
  if (locked.includes(feature))
    console.log(`${feature}: already approved, left unchanged`);
  else if (!draft) console.log(`${feature}: no draft to approve`);
  else {
    renameSync(join(draftsDir, draft), join(approvedDir, draft));
    console.log(`${feature}: approved as ${join(approvedDir, draft)}`);
  }
}
