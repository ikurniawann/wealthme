/**
 * A8 (revisi-2) — `useAppBack` decides between `router.back()` (in-app
 * history exists) and a fallback push to `/beranda` (landed here directly,
 * e.g. a deep link or a fresh tab).
 */
import { renderHook } from "@testing-library/react";
import { act } from "react";

let mockPathname = "/beranda";
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

import { useAppBack } from "./use-app-back";

describe("useAppBack", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockBack.mockClear();
    mockPush.mockClear();
    mockPathname = "/beranda";
  });

  test("falls back to /beranda when landing directly with no in-app history", () => {
    const { result } = renderHook(() => useAppBack());
    expect(result.current.canGoBack).toBe(false);

    act(() => result.current.goBack());

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/beranda");
  });

  test("calls router.back() once an in-app navigation has happened", () => {
    const { result, rerender } = renderHook(() => useAppBack());
    mockPathname = "/transaksi";
    rerender();

    expect(result.current.canGoBack).toBe(true);

    act(() => result.current.goBack());

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("depth survives across hook instances via sessionStorage", () => {
    const first = renderHook(() => useAppBack());
    mockPathname = "/transaksi";
    first.rerender();
    first.unmount();

    const second = renderHook(() => useAppBack());
    expect(second.result.current.canGoBack).toBe(true);
  });
});
