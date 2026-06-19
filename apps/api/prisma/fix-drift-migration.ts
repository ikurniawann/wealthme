import { PrismaClient } from "@prisma/client";

const STUCK = "20260617000001_add_missing_schema_drift";

const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*)::bigint AS cnt
      FROM _prisma_migrations
      WHERE migration_name = ${STUCK}
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    if (Number(rows[0].cnt) > 0) {
      console.log(
        "fix-drift: marking stuck drift migration as applied (schema objects already present)",
      );
      await prisma.$executeRaw`
        UPDATE _prisma_migrations
        SET finished_at = NOW(), applied_steps_count = 1
        WHERE migration_name = ${STUCK}
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
      `;
    }
  } catch {
    // _prisma_migrations does not exist on fresh DB — safe to ignore
  }
}

main().finally(() => prisma.$disconnect());
