import { act, renderHook } from "@testing-library/react";
import { useCountUp } from "./motion";

const mockSet = jest.fn();
const mockJump = jest.fn();
const mockSpring = { set: mockSet, jump: mockJump };
let mockOnChange: (value: number) => void;
const mockReduced = jest.fn(() => false);
jest.mock("motion/react", () => ({
  useSpring: () => mockSpring,
  useMotionValueEvent: (
    _spring: unknown,
    _event: string,
    callback: (value: number) => void,
  ) => {
    mockOnChange = callback;
  },
}));
jest.mock("../../hooks/use-media-query", () => ({
  useMediaQuery: () => mockReduced(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReduced.mockReturnValue(false);
});

it("retargets the existing spring without resetting its in-flight position", () => {
  const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
    initialProps: { target: 100 },
  });
  act(() => mockOnChange(42));
  expect(result.current).toBe(42);
  rerender({ target: 10 });
  expect(result.current).toBe(42);
  expect(mockSet.mock.calls).toEqual([[100], [10]]);
  expect(mockJump).not.toHaveBeenCalled();
});

it("jumps to the final value when reduced motion changes during animation", () => {
  const { result, rerender } = renderHook(() => useCountUp(100));
  act(() => mockOnChange(42));
  mockReduced.mockReturnValue(true);
  rerender();
  expect(result.current).toBe(100);
  expect(mockJump).toHaveBeenLastCalledWith(100);
});
