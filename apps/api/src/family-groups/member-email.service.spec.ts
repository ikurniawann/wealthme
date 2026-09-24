import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { MemberEmailService } from "./member-email.service";

import type { TransactionalMailService } from "../mail/transactional-mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ConfigService } from "@nestjs/config";

const FG = "fg-1";
const OWNER = "user-owner";

function setup() {
  const prisma = {
    member: {
      findUnique: jest.fn().mockResolvedValue({ role: Role.owner }),
      findFirst: jest.fn(),
    },
    user: {
      update: jest
        .fn()
        .mockResolvedValue({ name: "Budi", username: "budi@arsandi" }),
      findUnique: jest.fn(),
    },
  };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn(() => "https://wealthme.demo-wit.id") };
  const service = new MemberEmailService(
    prisma as unknown as PrismaService,
    mail as unknown as TransactionalMailService,
    config as unknown as ConfigService,
  );
  return { prisma, mail, service };
}

describe("MemberEmailService (EPIC-031)", () => {
  it("stores a pending email with a HASHED token and mails the raw link", async () => {
    const { prisma, mail, service } = setup();
    await service.startConfirmation("u1", " Budi@Gmail.com ");

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.pendingEmail).toBe("budi@gmail.com");
    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe("budi@gmail.com");
    const token = decodeURIComponent(/token=([^\s"&]+)/.exec(sent.text)![1]);
    expect(data.pendingEmailTokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(data.pendingEmailTokenHash).not.toContain(token);
    expect(sent.text).toContain(
      "https://wealthme.demo-wit.id/konfirmasi-email?token=",
    );
  });

  it("never fails the request when mail delivery fails", async () => {
    const { mail, service } = setup();
    mail.send.mockRejectedValue(new Error("smtp down"));
    await expect(
      service.startConfirmation("u1", "a@b.co"),
    ).resolves.toBeUndefined();
  });

  it("only this family's Master may set a member's email", async () => {
    const { prisma, service } = setup();
    prisma.member.findFirst.mockResolvedValue({
      userId: "u1",
      user: { managedByFamilyGroupId: "another-family" },
    });
    await expect(
      service.setForMember(FG, "m1", OWNER, "a@b.co"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.member.findUnique.mockResolvedValue({ role: Role.spouse });
    await expect(
      service.setForMember(FG, "m1", "u-spouse", "a@b.co"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("confirm: moves the pending email to the login email and burns the token", async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "u1",
        pendingEmail: "budi@gmail.com",
        pendingEmailExpiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce(null);
    await expect(service.confirm("tok")).resolves.toEqual({
      email: "budi@gmail.com",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        email: "budi@gmail.com",
        emailVerified: true,
        pendingEmail: null,
        pendingEmailTokenHash: null,
        pendingEmailExpiresAt: null,
      },
    });
  });

  it("confirm: rejects an unknown or expired token", async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.confirm("nope")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      pendingEmail: "x@y.co",
      pendingEmailExpiresAt: new Date(Date.now() - 1),
    });
    await expect(service.confirm("old")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("confirm: refuses an address another account already uses", async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "u1",
        pendingEmail: "taken@gmail.com",
        pendingEmailExpiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({ id: "someone-else" });
    await expect(service.confirm("tok")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a resend within the cooldown (no mail relay)", async () => {
    const { prisma, mail, service } = setup();
    prisma.member.findFirst.mockResolvedValue({
      userId: "u1",
      user: {
        managedByFamilyGroupId: FG,
        // sent 30s ago → expires 7 days minus 30s from now
        pendingEmailExpiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000 - 30_000,
        ),
      },
    });
    await expect(
      service.setForMember(FG, "m1", OWNER, "a@b.co"),
    ).rejects.toMatchObject({ status: 429 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("allows a resend after the cooldown", async () => {
    const { prisma, mail, service } = setup();
    prisma.member.findFirst.mockResolvedValue({
      userId: "u1",
      user: {
        managedByFamilyGroupId: FG,
        pendingEmailExpiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000 - 3 * 60_000,
        ),
      },
    });
    await service.setForMember(FG, "m1", OWNER, "a@b.co");
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});
