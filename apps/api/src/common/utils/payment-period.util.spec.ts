import { execFileSync } from "child_process";
import path from "path";

import { currentPaymentPeriodBounds } from "./payment-period.util";

// EPIC-023 group E retry round 4 (C2) — the bug this util fixes: a
// hardcoded calendar-month window read a `yearly` (or `quarterly`) policy
// paid in January as unpaid again starting in February, because the window
// was always "this calendar month" regardless of the obligation's own
// `premiumPeriod`. These tests pin the correct per-period window and, most
// importantly, that a payment near the START of a yearly/quarterly period
// still falls inside the SAME window near its END — the exact scenario the
// old hardcoded-month window got wrong.
describe("currentPaymentPeriodBounds", () => {
  it("monthly: bounds span the first to the last day of the current calendar month", () => {
    const now = new Date(2026, 5, 15); // June 15, 2026
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "monthly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 5, 1));
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("quarterly: bounds span the current calendar quarter (Q2 = Apr-Jun)", () => {
    const now = new Date(2026, 4, 20); // May 20, 2026 -> Q2
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "quarterly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 3, 1)); // April 1
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999)); // June 30
  });

  it("yearly: bounds span the entire calendar year", () => {
    const now = new Date(2026, 5, 15);
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "yearly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 0, 1));
    expect(periodEnd).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  // The regression this whole util exists to fix — pinned explicitly.
  it("yearly: a payment made in January still falls inside the SAME window checked from February onward", () => {
    const paidAt = new Date(2026, 0, 10); // January 10
    const checkedFromFebruary = currentPaymentPeriodBounds(
      "yearly",
      new Date(2026, 1, 1),
    );
    expect(paidAt >= checkedFromFebruary.periodStart).toBe(true);
    expect(paidAt <= checkedFromFebruary.periodEnd).toBe(true);
  });

  it("quarterly: a payment made in the first month of a quarter still falls inside the SAME window checked from the quarter's last month", () => {
    const paidAt = new Date(2026, 3, 2); // April 2 (Q2 start)
    const checkedFromJune = currentPaymentPeriodBounds(
      "quarterly",
      new Date(2026, 5, 25),
    );
    expect(paidAt >= checkedFromJune.periodStart).toBe(true);
    expect(paidAt <= checkedFromJune.periodEnd).toBe(true);
  });

  // H7 (group E retry round 4) — the regression this fix exists to close:
  // with no `TZ` set anywhere in the repo, a server whose local clock runs
  // UTC (a common hosted-Node default) computed calendar bounds in UTC
  // while every real user is in WIB (UTC+7). A payment at 03:00 WIB on the
  // 1st of the month is 20:00 UTC the DAY BEFORE — under the old
  // `now.getFullYear()/getMonth()` (server-local) implementation, that
  // instant landed in the PREVIOUS month's window, so the "current period"
  // window computed from a later moment the same WIB day would not contain
  // it — the same obligation reads unpaid and can be paid a second time.
  //
  // This dev container's OWN host timezone already happens to be
  // Asia/Jakarta (WIB) — so a plain in-process assertion here would pass
  // against the OLD, broken implementation too, for the wrong reason
  // (masking the exact regression this fix targets). Worse, mutating
  // `process.env.TZ` mid-process is NOT reliable for this: V8 revalidates
  // `Date.prototype.getFullYear()`/`getMonth()` against a changed `TZ`, but
  // NOT the LOCAL `new Date(y, m, d)` CONSTRUCTOR the old code used — that
  // still resolves against the timezone cached at process start, so an
  // in-process mutation silently fails to reproduce a genuinely
  // UTC-hosted server. A real subprocess, spawned with `TZ=UTC` set BEFORE
  // Node starts, is the only way to faithfully exercise "the host's local
  // clock is UTC" the way the finding describes.
  it("anchors to WIB regardless of the server's own local timezone (H7)", () => {
    const script = `
      import { currentPaymentPeriodBounds } from ${JSON.stringify(
        path.join(__dirname, "payment-period.util"),
      )};
      const bounds = currentPaymentPeriodBounds(
        "monthly",
        new Date("2026-08-15T12:00:00+07:00"),
      );
      console.log(JSON.stringify({
        periodStart: bounds.periodStart.toISOString(),
        periodEnd: bounds.periodEnd.toISOString(),
      }));
    `;
    const tsxBin = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "node_modules",
      ".bin",
      "tsx",
    );
    const stdout = execFileSync(tsxBin, ["-e", script], {
      env: { ...process.env, TZ: "UTC" },
      encoding: "utf8",
    });
    const { periodStart, periodEnd } = JSON.parse(stdout) as {
      periodStart: string;
      periodEnd: string;
    };

    // An unambiguous instant: 1 Aug 2026, 03:00 WIB = 31 Jul 2026, 20:00 UTC
    // — must fall inside AUGUST's window, not July's. On a genuinely
    // UTC-hosted process, the OLD implementation computed August's window
    // as [2026-08-01T00:00:00.000Z, ...), which EXCLUDES this instant.
    const earlyMorningWib = new Date("2026-08-01T03:00:00+07:00");
    expect(earlyMorningWib >= new Date(periodStart)).toBe(true);
    expect(earlyMorningWib <= new Date(periodEnd)).toBe(true);

    // Pinned exact instants: 1 Aug 2026 00:00 WIB = 31 Jul 2026 17:00 UTC;
    // 1 Sep 2026 00:00 WIB minus 1ms = 31 Aug 2026 16:59:59.999 UTC.
    expect(periodStart).toBe("2026-07-31T17:00:00.000Z");
    expect(periodEnd).toBe("2026-08-31T16:59:59.999Z");
  });
});
