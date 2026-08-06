import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

const MAX_ATTEMPTS = 3;

/**
 * EPIC-023 group E retry (HIGH 2) — extracted out of
 * `LiabilitiesService.pay()` so `InsurancesService.pay()` (and any future
 * caller with the same shape of race) shares ONE definition instead of a
 * second, possibly-drifting copy. See `LiabilitiesService.pay()`'s history
 * (EPIC-023 Task A review) for the full Postgres rationale this docblock
 * summarizes:
 *
 * A read-then-write pair (read a balance, compute a value from it, write it
 * back) is not safe under READ COMMITTED: two concurrent callers can both
 * read the same starting value, both compute a valid-looking result, and
 * both commit — silently under- or over-applying the combined effect
 * (EPIC-021 #22's bank-overdraft floor is exactly the invariant this can
 * bypass). Running the transaction at SERIALIZABLE isolation makes Postgres
 * detect the conflicting concurrent write and abort the loser with a
 * serialization failure (P2034); this wrapper retries that a bounded number
 * of times so the loser re-reads the now-current state and recomputes
 * correctly instead of surfacing a raw 500 for what is, from the caller's
 * point of view, a transient conflict.
 *
 * Also retries P2002 (a unique-constraint violation) for the identical
 * reason `LiabilitiesService.pay()` already did: two concurrent first-ever
 * calls can race to self-heal (create) the same Category row. Recovering
 * inside the SAME aborted transaction is impossible — Postgres aborts the
 * whole transaction on any statement error (25P02, "current transaction is
 * aborted") and Prisma's interactive `$transaction` issues no savepoints —
 * so the fix is the same shape as P2034: roll back and retry in a fresh
 * transaction, where the self-heal lookup now finds the winner's
 * already-committed row.
 */
export async function runSerializableWithRetry<T>(
  prisma: PrismaService,
  work: (tx: TxClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const isRetryable =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2034" || err.code === "P2002");
      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        throw err;
      }
      // Retry: another concurrent call committed first. Looping re-enters
      // $transaction, which re-reads state inside `work` against the
      // now-current, post-conflict state.
    }
  }
  // Unreachable — the loop above always either returns or throws.
  throw new Error("runSerializableWithRetry: retry loop exited unexpectedly");
}
