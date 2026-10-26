import { act, renderHook } from "@testing-library/react";
import { useViewTransition } from "./use-view-transition";

const mockReduced = jest.fn(() => false);
jest.mock("./use-media-query", () => ({ useMediaQuery: () => mockReduced() }));
const original = document.startViewTransition;
afterEach(() => {
  document.startViewTransition = original;
  mockReduced.mockReturnValue(false);
});

it("updates without animation when unsupported or reduced motion is enabled", () => {
  const update = jest.fn();
  document.startViewTransition =
    undefined as unknown as typeof document.startViewTransition;
  const { result, rerender } = renderHook(useViewTransition);
  act(() => result.current(update));
  expect(update).toHaveBeenCalledTimes(1);
  document.startViewTransition = jest.fn();
  mockReduced.mockReturnValue(true);
  rerender();
  act(() => result.current(update));
  expect(document.startViewTransition).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledTimes(2);
});

it("skips an interrupted transition and discards its stale pending update", () => {
  const callbacks: (() => void)[] = [];
  const skip = jest.fn();
  document.startViewTransition = jest.fn((update: () => void) => {
    callbacks.push(update);
    return {
      skipTransition: skip,
      ready: Promise.resolve(),
      finished: new Promise(() => {}),
    };
  }) as unknown as typeof document.startViewTransition;
  const first = jest.fn(),
    second = jest.fn();
  const { result } = renderHook(useViewTransition);
  act(() => {
    result.current(first);
    result.current(second);
    callbacks[0]();
    callbacks[1]();
  });
  expect(skip).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
