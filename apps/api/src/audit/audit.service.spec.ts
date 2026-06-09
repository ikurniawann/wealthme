import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { AuditService } from "./audit.service";

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
  },
};

describe("AuditService", () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe("log()", () => {
    it("calls prisma.auditLog.create with the correct DTO fields", async () => {
      // Arrange
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      await service.log({
        userId: "user-1",
        familyGroupId: "fg-1",
        action: "create",
        entity: "Transaction",
        entityId: "txn-1",
        before: { body: { amount: 100 } },
        after: { body: { id: "txn-1", amount: 100 } },
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      });

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          familyGroupId: "fg-1",
          action: "create",
          entity: "Transaction",
          entityId: "txn-1",
          before: { body: { amount: 100 } },
          after: { body: { id: "txn-1", amount: 100 } },
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        },
      });
    });

    it("does not throw when Prisma fails — swallows the error and logs it", async () => {
      // Arrange
      mockPrisma.auditLog.create.mockRejectedValue(
        new Error("DB connection lost"),
      );
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      // Act — must not throw
      await expect(
        service.log({
          userId: "user-2",
          action: "delete",
          entity: "Account",
        }),
      ).resolves.toBeUndefined();

      // Assert — error was logged
      expect(loggerSpy).toHaveBeenCalledWith(
        "Failed to write audit log",
        expect.objectContaining({ error: "DB connection lost" }),
      );

      loggerSpy.mockRestore();
    });
  });
});
