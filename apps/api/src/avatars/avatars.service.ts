import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";

// Injected by class reference — must stay real imports (Nest DI).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StoragePort } from "../storage/storage.port";

import {
  MAX_AVATAR_BYTES,
  avatarUrlFor,
  detectAvatarMime,
  extensionForAvatar,
  isAvatarKey,
  isAvatarMime,
  type AvatarMime,
} from "./avatar.util";

export type AvatarUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

export type AvatarStream = {
  stream: NodeJS.ReadableStream;
  mimeType: AvatarMime;
};

const MIME_BY_EXTENSION: Record<string, AvatarMime> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  /** Stores a new avatar for `userId` (always the caller — the controller
   * only ever passes the authenticated subject) and points User.image at it. */
  async setAvatar(
    userId: string,
    file: AvatarUpload,
  ): Promise<{ avatarUrl: string | null }> {
    if (file.size > MAX_AVATAR_BYTES || file.buffer.length > MAX_AVATAR_BYTES) {
      throw new PayloadTooLargeException("Avatar must be 2 MB or smaller");
    }
    if (!isAvatarMime(file.mimetype)) {
      throw new BadRequestException("Avatar must be a JPEG, PNG or WEBP image");
    }
    const detected = detectAvatarMime(file.buffer);
    if (!detected || detected !== file.mimetype) {
      throw new BadRequestException(
        "File content does not match a JPEG, PNG or WEBP image",
      );
    }

    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { image: true },
    });
    const key = `avatars/${userId}/${randomUUID()}.${extensionForAvatar(detected)}`;
    await this.storage.upload(key, file.buffer, detected);
    await this.prisma.user.update({
      where: { id: userId },
      data: { image: key },
    });
    await this.removeStoredFile(previous.image);
    return { avatarUrl: avatarUrlFor(userId, key) };
  }

  async clearAvatar(userId: string): Promise<void> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { image: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });
    await this.removeStoredFile(previous.image);
  }

  /**
   * Streams `targetUserId`'s avatar to `requesterId` — only for the user
   * themself or someone sharing an active family membership with them.
   * Everything else is a 404 so the route never reveals whether a
   * cross-tenant user exists or has a picture.
   */
  async streamAvatar(
    requesterId: string,
    targetUserId: string,
  ): Promise<AvatarStream> {
    if (requesterId !== targetUserId) {
      const shared = await this.prisma.member.findFirst({
        where: {
          userId: targetUserId,
          deletedAt: null,
          familyGroup: {
            members: { some: { userId: requesterId, deletedAt: null } },
          },
        },
        select: { id: true },
      });
      if (!shared) throw new NotFoundException("Avatar not found");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { image: true },
    });
    const key = user?.image;
    if (!isAvatarKey(key)) throw new NotFoundException("Avatar not found");
    const mimeType = MIME_BY_EXTENSION[key.slice(key.lastIndexOf(".") + 1)];
    if (!mimeType) throw new NotFoundException("Avatar not found");
    return { stream: await this.storage.download(key), mimeType };
  }

  private async removeStoredFile(image: string | null): Promise<void> {
    if (!isAvatarKey(image)) return;
    try {
      await this.storage.delete(image);
    } catch (err) {
      // The DB no longer references it; an orphaned file is harmless and
      // must not fail the user's request.
      this.logger.warn(`Failed to delete old avatar ${image}: ${String(err)}`);
    }
  }
}
