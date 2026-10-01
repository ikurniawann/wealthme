import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";

import { avatarUrlFor, MAX_AVATAR_BYTES } from "./avatar.util";
import { AvatarsController } from "./avatars.controller";
import { AvatarsService } from "./avatars.service";

const ME = "user-me";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF = Buffer.from("%PDF-1.7 not an image");
const GIF = Buffer.from("GIF89a....");

function make() {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ image: null }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    member: { findFirst: jest.fn() },
  };
  const storage = {
    upload: jest.fn().mockImplementation((key: string) => key),
    getSignedUrl: jest.fn(),
    download: jest.fn().mockResolvedValue({ pipe: jest.fn(), on: jest.fn() }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AvatarsService(prisma as never, storage as never);
  return { service, prisma, storage };
}

const file = (buffer: Buffer, mimetype: string, size = buffer.length) => ({
  buffer,
  mimetype,
  size,
});

describe("AvatarsService.setAvatar", () => {
  it("stores under avatars/<userId>/ and sets User.image to the key", async () => {
    const { service, prisma, storage } = make();
    const res = await service.setAvatar(ME, file(PNG, "image/png"));

    const key = storage.upload.mock.calls[0][0] as string;
    expect(key).toMatch(new RegExp(`^avatars/${ME}/[0-9a-f-]{36}\\.png$`));
    expect(storage.upload).toHaveBeenCalledWith(key, PNG, "image/png");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: ME },
      data: { image: key },
    });
    expect(res.avatarUrl).toBe(avatarUrlFor(ME, key));
    expect(res.avatarUrl).toMatch(new RegExp(`^/users/${ME}/avatar\\?v=`));
  });

  it("deletes the previous stored avatar after replacing it", async () => {
    const { service, prisma, storage } = make();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      image: `avatars/${ME}/old.jpg`,
    });
    await service.setAvatar(ME, file(JPEG, "image/jpeg"));
    expect(storage.delete).toHaveBeenCalledWith(`avatars/${ME}/old.jpg`);
  });

  it.each([
    ["a PDF", PDF, "application/pdf"],
    ["a GIF", GIF, "image/gif"],
    ["a PDF claiming to be PNG", PDF, "image/png"],
    ["a JPEG claiming to be PNG", JPEG, "image/png"],
  ])("rejects %s", async (_label, buffer, mime) => {
    const { service, storage, prisma } = make();
    await expect(service.setAvatar(ME, file(buffer, mime))).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects files over 2 MB", async () => {
    const { service, storage } = make();
    await expect(
      service.setAvatar(ME, file(PNG, "image/png", MAX_AVATAR_BYTES + 1)),
    ).rejects.toThrow(PayloadTooLargeException);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe("AvatarsService.clearAvatar", () => {
  it("nulls User.image and removes the stored file", async () => {
    const { service, prisma, storage } = make();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      image: `avatars/${ME}/a.webp`,
    });
    await service.clearAvatar(ME);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: ME },
      data: { image: null },
    });
    expect(storage.delete).toHaveBeenCalledWith(`avatars/${ME}/a.webp`);
  });
});

describe("AvatarsService.streamAvatar", () => {
  it("streams a family member's avatar", async () => {
    const { service, prisma, storage } = make();
    prisma.member.findFirst.mockResolvedValue({ id: "m1" });
    prisma.user.findUnique.mockResolvedValue({ image: "avatars/kid/x.webp" });
    const res = await service.streamAvatar(ME, "kid");
    expect(res.mimeType).toBe("image/webp");
    expect(storage.download).toHaveBeenCalledWith("avatars/kid/x.webp");
    expect(prisma.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "kid",
          familyGroup: {
            members: { some: { userId: ME, deletedAt: null } },
          },
        }),
      }),
    );
  });

  it("404s for a user outside every family of the requester", async () => {
    const { service, prisma, storage } = make();
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.streamAvatar(ME, "stranger")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(storage.download).not.toHaveBeenCalled();
  });

  it("404s when the user has no stored avatar", async () => {
    const { service, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({
      image: "https://lh3.example/x",
    });
    await expect(service.streamAvatar(ME, ME)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("AvatarsController self-only writes", () => {
  it("uploads and deletes for the authenticated subject only", async () => {
    const avatars = {
      setAvatar: jest.fn().mockResolvedValue({ avatarUrl: "/x" }),
      clearAvatar: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AvatarsController(avatars as never);
    const req = {
      user: { sub: ME },
      params: { userId: "victim" },
      body: { userId: "victim" },
    } as never;

    await controller.upload(req, {
      buffer: PNG,
      size: PNG.length,
      mimetype: "image/png",
    } as Express.Multer.File);
    await controller.remove(req);

    expect(avatars.setAvatar).toHaveBeenCalledWith(ME, expect.anything());
    expect(avatars.clearAvatar).toHaveBeenCalledWith(ME);
  });

  it("400s when no file is sent", async () => {
    const controller = new AvatarsController({} as never);
    await expect(
      controller.upload({ user: { sub: ME } } as never, undefined),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("avatarUrlFor", () => {
  it("maps keys to the stream route, passes https, drops the rest", () => {
    expect(avatarUrlFor("u", "avatars/u/f.png")).toBe(
      "/users/u/avatar?v=f.png",
    );
    expect(avatarUrlFor("u", "https://a/b.png")).toBe("https://a/b.png");
    expect(avatarUrlFor("u", "javascript:alert(1)")).toBeNull();
    expect(avatarUrlFor("u", null)).toBeNull();
  });
});
