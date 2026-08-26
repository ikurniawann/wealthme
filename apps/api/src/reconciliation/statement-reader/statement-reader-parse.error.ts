/**
 * EPIC-029 group 2 — the provider answered, but not with the contract
 * `statementReadingSchema` describes (prose instead of JSON, a truncated
 * table, or — the one that matters — an `amount` returned as a NUMBER
 * instead of the printed cell text).
 *
 * Distinguished from an auth/rate-limit/timeout failure so the endpoint can
 * say "this statement could not be read" rather than a generic upstream
 * error. The provider's raw output is deliberately NOT carried in the
 * message: it is echoed to the client and may contain arbitrary model text,
 * including fragments of the statement itself.
 */
export class StatementReaderParseError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `Statement reading did not match the expected shape (${detail})`
        : "Statement reading did not match the expected shape",
    );
    this.name = "StatementReaderParseError";
  }
}
