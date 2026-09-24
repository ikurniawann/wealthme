/**
 * Notifications had no recipient at all: every row was family-wide, and the
 * roles that actually file funding requests (`dependant`/`operational`) had no
 * CASL grant on Notification, so a child's approved request was announced
 * exclusively in the owner's list. These tests pin the two halves of the fix —
 * who a row is addressed to, and who may read it — including the part that is
 * easy to regress: the list, the unread badge, and mark-read must all apply
 * the SAME visibility clause.
 */
import { NotificationsService } from "./notifications.service";

const FAMILY_GROUP_ID = "fg-1";
const VIEWER_ID = "user-viewer";

function makePrisma() {
  return {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationRead: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NotificationsService(prisma as any);
}

/** What a trusted role must see: household rows plus their own. */
const TRUSTED_WHERE = {
  familyGroupId: FAMILY_GROUP_ID,
  OR: [{ userId: null }, { userId: VIEWER_ID }],
};

/** What a row-scoped role must see: their own rows and nothing else. */
const ROW_SCOPED_WHERE = {
  familyGroupId: FAMILY_GROUP_ID,
  userId: VIEWER_ID,
};

describe("NotificationsService — visibility", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it.each(["owner", "spouse", "admin_staff", "member"] as const)(
    "shows %s the household rows plus their own",
    async (role) => {
      await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, role);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: TRUSTED_WHERE }),
      );
    },
  );

  it.each(["dependant", "operational"] as const)(
    "shows %s ONLY rows addressed to them — never the household ones",
    async (role) => {
      await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, role);

      // Household rows carry whole-family figures (net worth goals, KPR due
      // dates, budget thresholds) and other members' funding requests — the
      // surface `assertHouseholdWideReadAllowed` denies these roles in
      // reports. A `userId: null` branch here would reopen it.
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: ROW_SCOPED_WHERE }),
      );
    },
  );

  // EPIC-030 — the Master's effective data scope wins over the built-in type.
  it("narrows a Master-scoped 'own data' member to their own rows", async () => {
    await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, {
      role: "member",
      rowScoped: true,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: ROW_SCOPED_WHERE }),
    );
  });

  it("widens a dependant the Master gave family data to household rows", async () => {
    await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, {
      role: "dependant",
      rowScoped: false,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: TRUSTED_WHERE }),
    );
  });

  it("applies the same clause to the unread badge as to the list", async () => {
    // A mismatch shows a badge counting rows the list refuses to render —
    // a count the user can never clear.
    await service.getUnreadCount(FAMILY_GROUP_ID, VIEWER_ID, "dependant");

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { ...ROW_SCOPED_WHERE, reads: { none: { userId: VIEWER_ID } } },
    });
  });

  it("keeps 'mark all read' inside what the caller can see", async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: "n1" },
      { id: "n2" },
    ]);
    await service.markRead(FAMILY_GROUP_ID, VIEWER_ID, "dependant", {});

    // Without the visibility clause a child pressing "Tandai semua dibaca"
    // would mark the whole family's notifications read.
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { ...ROW_SCOPED_WHERE, reads: { none: { userId: VIEWER_ID } } },
      select: { id: true },
    });
    expect(prisma.notificationRead.createMany).toHaveBeenCalledWith({
      data: [
        { notificationId: "n1", userId: VIEWER_ID },
        { notificationId: "n2", userId: VIEWER_ID },
      ],
      skipDuplicates: true,
    });
  });

  it("scopes mark-read-by-id too, so an id alone is not authorisation", async () => {
    await service.markRead(FAMILY_GROUP_ID, VIEWER_ID, "dependant", {
      ids: ["notif-belonging-to-someone-else"],
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        ...ROW_SCOPED_WHERE,
        reads: { none: { userId: VIEWER_ID } },
        id: { in: ["notif-belonging-to-someone-else"] },
      },
      select: { id: true },
    });
  });

  // Per-member read state: marking read writes a receipt for THIS viewer
  // only and never flips a shared flag other members would see.
  it("marks read for the viewer only — never the shared row", async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: "n1" }]);
    const res = await service.markRead(FAMILY_GROUP_ID, VIEWER_ID, "owner", {
      ids: ["n1"],
    });
    expect(res).toEqual({ updated: 0 });
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    expect(prisma.notificationRead.createMany).toHaveBeenCalledWith({
      data: [{ notificationId: "n1", userId: VIEWER_ID }],
      skipDuplicates: true,
    });
  });

  it("reports isRead from the viewer's own receipt", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "a",
        title: "t",
        body: "b",
        icon: null,
        createdAt: new Date("2026-09-25T00:00:00Z"),
        reads: [{ userId: VIEWER_ID }],
      },
      {
        id: "b",
        title: "t",
        body: "b",
        icon: null,
        createdAt: new Date("2026-09-25T00:00:00Z"),
        reads: [],
      },
    ]);
    const rows = await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, "owner");
    expect(rows.map((r) => [r.id, r.isRead])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(rows[0]).not.toHaveProperty("reads");
  });

  it("does nothing when there is nothing unread", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await expect(
      service.markRead(FAMILY_GROUP_ID, VIEWER_ID, "owner", {}),
    ).resolves.toEqual({ updated: 0 });
    expect(prisma.notificationRead.createMany).not.toHaveBeenCalled();
  });

  it("treats an unknown role as trusted-but-not-row-scoped rather than throwing", async () => {
    // `member` in tenantContext can be null on odd paths; the list must still
    // resolve, and it must not silently widen to every row in the family.
    await service.findAll(FAMILY_GROUP_ID, VIEWER_ID, null);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: TRUSTED_WHERE }),
    );
  });
});
