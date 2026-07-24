import { ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { FamilyGroupsService } from "./family-groups.service";

// EPIC-016 Task D — these endpoints already existed and already honored
// `role` correctly, but had never been exercised by any frontend control
// (AddAdminDialog hardcoded `role: "admin_staff"`; updateMemberRole/
// removeMember were completely unused). They're now load-bearing for the
// real "Peran" selector and the real "Kelola akses" menu, so this is their
// first test coverage.
const mockPrisma = {
  familyGroup: { findUnique: jest.fn() },
  invitation: { create: jest.fn() },
  member: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe("FamilyGroupsService", () => {
  let service: FamilyGroupsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FamilyGroupsService>(FamilyGroupsService);
  });

  describe("createInvitation()", () => {
    beforeEach(() => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.owner });
      mockPrisma.familyGroup.findUnique.mockResolvedValue({
        name: "Keluarga Arsandi",
      });
    });

    it("persists the caller-selected role (member), not a hardcoded admin_staff", async () => {
      mockPrisma.invitation.create.mockResolvedValue({
        id: "inv-1",
        token: "tok-1",
        familyGroupId: "fg-1",
        email: "budi@example.com",
        role: Role.member,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-07-24T00:00:00.000Z"),
      });

      const result = await service.createInvitation("fg-1", "owner-1", {
        email: "budi@example.com",
        role: Role.member,
      });

      expect(mockPrisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.member }),
        }),
      );
      expect(result.role).toBe(Role.member);
      expect(result.role).not.toBe(Role.admin_staff);
    });

    it("persists admin_staff when that's what was selected", async () => {
      mockPrisma.invitation.create.mockResolvedValue({
        id: "inv-2",
        token: "tok-2",
        familyGroupId: "fg-1",
        email: "staf@example.com",
        role: Role.admin_staff,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-07-24T00:00:00.000Z"),
      });

      const result = await service.createInvitation("fg-1", "owner-1", {
        email: "staf@example.com",
        role: Role.admin_staff,
      });

      expect(result.role).toBe(Role.admin_staff);
    });

    it("rejects a non-owner requester", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.member });

      await expect(
        service.createInvitation("fg-1", "member-1", {
          email: "x@example.com",
          role: Role.member,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
    });
  });

  describe("updateMemberRole()", () => {
    it("downgrades an admin_staff member to member (real 'Kelola akses' action)", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.owner });
      mockPrisma.member.findFirst.mockResolvedValue({
        id: "member-1",
        role: Role.admin_staff,
      });
      mockPrisma.member.update.mockResolvedValue({
        id: "member-1",
        userId: "user-1",
        familyGroupId: "fg-1",
        role: Role.member,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Budi Santoso", email: "budi@example.com" },
      });

      const result = await service.updateMemberRole(
        "fg-1",
        "member-1",
        "owner-1",
        { role: Role.member },
      );

      expect(mockPrisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "member-1" },
          data: { role: Role.member },
        }),
      );
      expect(result.role).toBe(Role.member);
    });

    it("rejects a non-owner requester", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.member });

      await expect(
        service.updateMemberRole("fg-1", "member-1", "requester-1", {
          role: Role.member,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.member.update).not.toHaveBeenCalled();
    });
  });

  describe("removeMember()", () => {
    it("removes a member (real 'Hapus dari Family' action)", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.owner });
      mockPrisma.member.findFirst.mockResolvedValue({
        id: "member-1",
        role: Role.admin_staff,
      });

      await service.removeMember("fg-1", "member-1", "owner-1");

      expect(mockPrisma.member.delete).toHaveBeenCalledWith({
        where: { id: "member-1" },
      });
    });

    it("rejects a non-owner requester", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({ role: Role.member });

      await expect(
        service.removeMember("fg-1", "member-1", "requester-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.member.delete).not.toHaveBeenCalled();
    });
  });
});
