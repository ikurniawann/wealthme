import { randomUUID } from "node:crypto";

import request from "supertest";

import type { PrismaService } from "../../../src/prisma/prisma.service";
import type { INestApplication } from "@nestjs/common";

export interface TestUserCredentials {
  email: string;
  password: string;
  name: string;
}

export interface AuthenticatedTestUser {
  userId: string;
  /** The bearer token every guarded endpoint actually accepts. */
  token: string;
}

/**
 * Mints the credential the API really authorises with.
 *
 * `POST /auth/register` and `/auth/login` hand back a JWT pair, but no guard
 * in the running app consumes them: `BetterAuthGuard` (the global APP_GUARD)
 * looks the bearer token up as a row in the `session` table and rejects
 * anything it cannot find there. Specs that authenticated with the JWT got a
 * 401 from every protected route — which reads as "authorisation is broken"
 * when it actually means "this suite is holding the wrong kind of token", and
 * is why the cross-tenant isolation checks below were passing/failing for
 * reasons unrelated to tenancy.
 *
 * A session row is exactly what the web app's Better Auth sign-in creates, so
 * issuing one here keeps the specs on the real authorisation path.
 */
export async function createSessionToken(
  prisma: PrismaService,
  userId: string,
  familyGroupId: string | null = null,
): Promise<string> {
  const token = `e2e-${randomUUID()}`;
  await prisma.baSession.create({
    data: {
      token,
      userId,
      familyGroupId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

/**
 * Registers a user through the real endpoint (so the User, Member and COA
 * chart are provisioned exactly as in production), then returns a usable
 * session token for it.
 */
export async function registerAndAuthenticate(
  app: INestApplication,
  prisma: PrismaService,
  user: TestUserCredentials,
): Promise<AuthenticatedTestUser> {
  const res = await request(app.getHttpServer())
    .post("/auth/register")
    .send(user);
  if (res.status !== 201) {
    throw new Error(
      `register failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  const row = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  if (!row) throw new Error(`user ${user.email} missing after register`);

  return { userId: row.id, token: await createSessionToken(prisma, row.id) };
}
