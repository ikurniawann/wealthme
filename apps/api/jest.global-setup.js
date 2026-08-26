// EPIC-029 — pin the suite's timezone BEFORE the workers fork.
//
// `parseStatementDate`'s date-only path must yield the same UTC instant
// wherever it runs, and that bug class is INVISIBLE under TZ=UTC (the default
// on most CI runners), where local and UTC calendar fields are identical.
//
// This must be globalSetup, not setupFiles: setupFiles runs inside a worker
// after Node has already resolved the zone, so an ambient TZ=UTC still wins
// and the guard silently stops guarding. globalSetup runs in the parent, so
// the value is inherited by every worker at fork time. Verified by running
// the suite with TZ=UTC forced from the shell.
module.exports = () => {
  process.env.TZ = "Asia/Jakarta";
};
