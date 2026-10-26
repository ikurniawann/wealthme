import { act, renderHook } from "@testing-library/react";
import { useDelayedLoading } from "./use-delayed-loading";

describe("delayed loading", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("never flashes for a fast request and restarts the delay for the next request", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading),
      {
        initialProps: { loading: true },
      },
    );
    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe(false);
    rerender({ loading: false });
    act(() => jest.advanceTimersByTime(500));
    expect(result.current).toBe(false);
    rerender({ loading: true });
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe(true);
    rerender({ loading: false });
    expect(result.current).toBe(false);
  });
});
