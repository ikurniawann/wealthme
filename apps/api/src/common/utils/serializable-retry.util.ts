import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

export type TxClient = Parameters<
  Parameters<PrismaService["$transaction"]>[0]
>[0];

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * EPIC-023 F3 (D21) — extracted out of `LiabilitiesService.pay()`, which
 * had this exact bounded-retry-over-Serializable-isolation shape inline
 * (see that method's comment for the full Postgres rationale: a plain
 * READ COMMITTED `$transaction` is not enough for a read-then-write over a
 * balance/status a concurrent request could also be reading, so this runs
 * at Serializable isolation and retries the bounded number of times a
 * losing transaction needs to re-read the now-current state and recompute
 * correctly instead of surfacing a raw 500 for what is, from the caller's
 * point of view, a transient conflict).
 *
 * `SplitBillsService.confirmParticipant()` is the second call site with
 * the identical shape (read a participant's status, decide whether to
 * post a Transaction + credit an Account, write both) — this util is
 * where a third call site should reach for the pattern instead of
 * re-inlining it a second time.
 *
 * Retryable errors: P2034 (serialization failure Postgres raises when
 * Serializable isolation detects a conflicting concurrent write) and
 * P2002 (a concurrent unique-constraint race, e.g. two callers both
 * self-healing the same missing row) — both are rolled back and retried
 * in a fresh `$transaction`, never recovered on the same aborted `tx`
 * (impossible against real Postgres; see `LiabilitiesService`'s
 * `createCategoryOrUseRaceWinner` comment). Any other error is rethrown
 * immediately; both known codes are rethrown once `maxAttempts` is spent.
 */
export async function runSerializableWithRetry<T>(
  prisma: PrismaService,
  fn: (tx: TxClient) => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const isRetryable =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2034" || err.code === "P2002");
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      // Retry: loop re-enters $transaction, which re-reads state inside
      // `fn` against the now-current, post-conflict state.
    }
  }
  // Unreachable — the loop above always either returns or throws.
  throw new Error("runSerializableWithRetry() retry loop exited unexpectedly");
}
