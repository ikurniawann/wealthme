import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { FeedbackService } from "./feedback.service";

// EPIC-016 Task E — the `/akun` feedback textarea previously bound to
// nothing and discarded whatever the user typed; this is the first coverage
// for the real persistence path behind it.
const mockPrisma = {
  feedback: {
    create: jest.fn(),
  },
};

describe("FeedbackService", () => {
  let service: FeedbackService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
  });

  describe("create()", () => {
    it("persists the feedback message scoped to the authenticated user", async () => {
      mockPrisma.feedback.create.mockResolvedValue({
        id: "fb-1",
        message: "Aplikasi keren, tapi ada bug di /laporan",
        createdAt: new Date("2026-07-24T00:00:00.000Z"),
      });

      const result = await service.create("user-1", {
        message: "Aplikasi keren, tapi ada bug di /laporan",
      });

      expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          message: "Aplikasi keren, tapi ada bug di /laporan",
        },
        select: { id: true, message: true, createdAt: true },
      });
      expect(result).toEqual({
        id: "fb-1",
        message: "Aplikasi keren, tapi ada bug di /laporan",
        createdAt: "2026-07-24T00:00:00.000Z",
      });
    });

    it("scopes each feedback row to the calling user, not a shared/global record", async () => {
      mockPrisma.feedback.create.mockResolvedValue({
        id: "fb-2",
        message: "Fitur ekspor PDF kurang lengkap",
        createdAt: new Date("2026-07-24T01:00:00.000Z"),
      });

      await service.create("user-2", {
        message: "Fitur ekspor PDF kurang lengkap",
      });

      expect(mockPrisma.feedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "user-2" }),
        }),
      );
    });
  });
});
