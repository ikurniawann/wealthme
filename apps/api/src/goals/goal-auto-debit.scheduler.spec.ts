import {
  AUTO_DEBIT_CRON,
  GoalAutoDebitScheduler,
} from "./goal-auto-debit.scheduler";

function makeQueue(existing: { key: string; name: string; pattern: string }[]) {
  return {
    getRepeatableJobs: jest.fn().mockResolvedValue(existing),
    removeRepeatableByKey: jest.fn().mockResolvedValue(true),
    add: jest.fn().mockResolvedValue({}),
  };
}

describe("GoalAutoDebitScheduler (Revisi F — daily)", () => {
  it("runs daily at 03:00", () => {
    expect(AUTO_DEBIT_CRON).toBe("0 3 * * *");
  });

  it("removes the old monthly repeatable before registering the daily one under the same jobId", async () => {
    const queue = makeQueue([
      { key: "legacy-monthly", name: "run-auto-debit", pattern: "0 3 1 * *" },
      { key: "someone-else", name: "other-job", pattern: "0 3 1 * *" },
    ]);

    await new GoalAutoDebitScheduler(queue as never).onModuleInit();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith("legacy-monthly");
    expect(queue.add).toHaveBeenCalledWith(
      "run-auto-debit",
      {},
      { repeat: { pattern: "0 3 * * *" }, jobId: "goal-auto-debit-cron" },
    );
    expect(
      queue.removeRepeatableByKey.mock.invocationCallOrder[0],
    ).toBeLessThan(queue.add.mock.invocationCallOrder[0]!);
  });

  it("leaves an already-daily repeatable alone on restart", async () => {
    const queue = makeQueue([
      { key: "daily", name: "run-auto-debit", pattern: "0 3 * * *" },
    ]);

    await new GoalAutoDebitScheduler(queue as never).onModuleInit();

    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
