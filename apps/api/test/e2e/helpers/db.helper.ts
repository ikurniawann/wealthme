import type { PrismaService } from "../../../src/prisma/prisma.service";

// Delete in FK dependency order (children before parents).
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.category.deleteMany(),
    prisma.account.deleteMany(),
    prisma.member.deleteMany(),
    prisma.familyGroup.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
