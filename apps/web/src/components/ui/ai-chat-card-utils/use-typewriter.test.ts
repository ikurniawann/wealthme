/**
 * G8 (hardening batch) — useTypewriter wasn't shipped with the pasted
 * AIChatCard source; written to its documented signature. These pin the
 * type -> hold -> delete -> gap cycle, the `enabled` kill switch, and the
 * prefers-reduced-motion static fallback.
 */

import { act, renderHook } from "@testing-library/react";

import { useTypewriter } from "./use-typewriter";

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

describe("useTypewriter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("types a prompt out character by character", () => {
    // Stable array reference, matching the documented calling contract
    // (a fresh array literal on every render would restart the loop).
    const prompts = ["Hi"];
    const { result } = renderHook(() =>
      useTypewriter(prompts, {
        typeMs: 10,
        holdMs: 100,
        deleteMs: 10,
        gapMs: 10,
      }),
    );

    // The first character types immediately on mount (no artificial
    // pre-delay); subsequent characters follow every `typeMs`, and phase
    // flips to "holding" one tick after the last character lands.
    expect(result.current.text).toBe("H");
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.text).toBe("Hi");
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.phase).toBe("holding");
  });

  it("holds, then deletes, then gaps before the next prompt", () => {
    const prompts = ["Ab", "Cd"];
    const { result } = renderHook(() =>
      useTypewriter(prompts, {
        typeMs: 10,
        holdMs: 20,
        deleteMs: 10,
        gapMs: 20,
      }),
    );

    // "A" types immediately; "b" lands after one more typeMs tick.
    act(() => jest.advanceTimersByTime(10));
    expect(result.current.text).toBe("Ab");

    // One more tick past the last character flips phase to "holding".
    act(() => jest.advanceTimersByTime(10));
    expect(result.current.phase).toBe("holding");

    // Hold elapses, deletion starts (first char removed immediately).
    act(() => jest.advanceTimersByTime(20));
    expect(result.current.phase).toBe("deleting");
    expect(result.current.text).toBe("A");

    // Delete the remaining character, then hit the empty "gap" phase.
    act(() => jest.advanceTimersByTime(20));
    expect(result.current.text).toBe("");
    expect(result.current.phase).toBe("gap");

    // Gap elapses, next prompt starts typing.
    act(() => jest.advanceTimersByTime(20));
    expect(result.current.text).toBe("C");
  });

  it("stops advancing once disabled", () => {
    const prompts = ["Hello"];
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTypewriter(prompts, { typeMs: 10, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => jest.advanceTimersByTime(20));
    const snapshot = result.current.text;
    expect(snapshot.length).toBeGreaterThan(0);

    rerender({ enabled: false });
    act(() => jest.advanceTimersByTime(100));
    expect(result.current.text).toBe(snapshot);
  });

  it("shows the first prompt fully typed, statically, under reduced motion", () => {
    mockMatchMedia(true);
    const prompts = ["Reduced motion prompt"];
    const { result } = renderHook(() => useTypewriter(prompts, { typeMs: 10 }));

    act(() => jest.advanceTimersByTime(1000));
    expect(result.current.text).toBe("Reduced motion prompt");
    expect(result.current.phase).toBe("holding");
  });
});
