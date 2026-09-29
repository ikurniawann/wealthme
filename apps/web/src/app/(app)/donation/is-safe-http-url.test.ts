/**
 * Hardening audit (validation, HIGH) — receiptUrl is rendered as `<a href>`
 * to every family member. The server now rejects a non-http(s) scheme, but
 * this is defense in depth on the client for data written before that
 * check existed.
 */
import { isSafeHttpUrl } from "./is-safe-http-url";

describe("isSafeHttpUrl", () => {
  it("accepts an https URL", () => {
    expect(isSafeHttpUrl("https://example.com/receipt.pdf")).toBe(true);
  });

  it("accepts an http URL", () => {
    expect(isSafeHttpUrl("http://example.com/receipt.pdf")).toBe(true);
  });

  it("rejects a javascript: URL", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects a data: URL", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(
      false,
    );
  });

  it("rejects a bare, unparseable string", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });
});
