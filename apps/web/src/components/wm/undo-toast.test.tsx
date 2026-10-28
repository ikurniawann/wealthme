import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { showDelayedUndoToast } from "./undo-toast";

const mockToast = Object.assign(jest.fn(), { dismiss: jest.fn() });
jest.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));
// The exported toast callable also owns dismiss.
import { toast } from "sonner";
Object.assign(toast, { dismiss: mockToast.dismiss });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

function start(commit = jest.fn().mockResolvedValue(undefined)) {
  const onUndo = jest.fn();
  const onError = jest.fn();
  const cancel = showDelayedUndoToast({
    message: "Dihapus",
    undoLabel: "Urungkan",
    onUndo,
    commit,
    onError,
  });
  return { cancel, commit, onUndo, onError };
}

it("announces status and delays the request for six seconds", async () => {
  const { commit } = start();
  render(mockToast.mock.calls[0][0] as ReactNode);
  expect(screen.getByRole("status")).toHaveTextContent("Dihapus");
  act(() => jest.advanceTimersByTime(5999));
  expect(commit).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(commit).toHaveBeenCalledTimes(1);
});

it("undo cancels the request entirely, even on repeated clicks", () => {
  const { commit, cancel, onUndo } = start();
  cancel();
  cancel();
  act(() => jest.advanceTimersByTime(10000));
  expect(commit).not.toHaveBeenCalled();
  expect(onUndo).toHaveBeenCalledTimes(1);
});

it("reports failures and prevents an expired Undo from restoring a committed action", async () => {
  const { cancel, onUndo, onError } = start(
    jest.fn().mockRejectedValue(new Error("offline")),
  );
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  cancel();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onUndo).not.toHaveBeenCalled();
});
