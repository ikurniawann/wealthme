import * as request from "supertest";

import { createTestApp } from "./helpers/app.helper";
import { cleanDatabase } from "./helpers/db.helper";

import type { PrismaService } from "../../src/prisma/prisma.service";
import type { INestApplication } from "@nestjs/common";

describe("RBAC / Tenant Isolation (E2E)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = {
    email: "user-a-rbac@example.com",
    password: "SecurePass123",
    name: "User A",
  };

  const userB = {
    email: "user-b-rbac@example.com",
    password: "SecurePass456",
    name: "User B",
  };

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  async function registerAndLogin(
    user: typeof userA,
  ): Promise<{ accessToken: string }> {
    await request(app.getHttpServer()).post("/auth/register").send(user);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password: user.password });

    return { accessToken: loginRes.body.accessToken as string };
  }

  async function createFamilyGroup(
    accessToken: string,
    name: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/family-groups")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name });

    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  describe("cross-tenant family group access", () => {
    it("userB cannot list accounts in userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/accounts`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect([403, 404]).toContain(response.status);
    });

    it("userB cannot create an account in userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .post(`/family-groups/${groupAId}/accounts`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          type: "BANK",
          name: "Stolen Account",
          balance: 0,
          currency: "IDR",
        });

      expect([403, 404]).toContain(response.status);
    });

    it("userB cannot list transactions in userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/transactions`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect([403, 404]).toContain(response.status);
    });

    it("userB cannot create a transaction in userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .post(`/family-groups/${groupAId}/transactions`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          accountId: "00000000-0000-0000-0000-000000000000",
          amount: 1000,
          type: "EXPENSE",
          occurredAt: new Date().toISOString(),
        });

      expect([403, 404]).toContain(response.status);
    });

    it("userB cannot list members of userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/members`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect([403, 404]).toContain(response.status);
    });

    it("userB cannot view dashboard summary of userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const { accessToken: tokenB } = await registerAndLogin(userB);

      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/dashboard/summary`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect([403, 404]).toContain(response.status);
    });
  });

  describe("own family group remains accessible", () => {
    it("userA can list accounts in their own family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/accounts`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
    });

    it("userA can list transactions in their own family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/transactions`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
    });

    it("userA can view dashboard summary of their own family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const response = await request(app.getHttpServer())
        .get(`/family-groups/${groupAId}/dashboard/summary`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
    });
  });

  describe("intra-group member role restrictions", () => {
    it("userB (MEMBER) cannot change member roles in userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const { accessToken: tokenB } = await registerAndLogin(userB);

      // userA invites userB
      const inviteRes = await request(app.getHttpServer())
        .post(`/family-groups/${groupAId}/invitations`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ email: userB.email });
      expect(inviteRes.status).toBe(201);
      const inviteToken = inviteRes.body.token as string;

      // userB accepts invitation (becomes MEMBER)
      const acceptRes = await request(app.getHttpServer())
        .post(`/family-groups/invitations/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(acceptRes.status).toBe(201);
      const memberBId = acceptRes.body.id as string;

      // userB (MEMBER) tries to promote themselves to OWNER — must be denied
      const changeRoleRes = await request(app.getHttpServer())
        .patch(`/family-groups/${groupAId}/members/${memberBId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ role: "OWNER" });

      expect([403, 404]).toContain(changeRoleRes.status);
    });

    it("userB (MEMBER) cannot remove members from userA's family group", async () => {
      const { accessToken: tokenA } = await registerAndLogin(userA);
      const groupAId = await createFamilyGroup(tokenA, "Family Group A");

      const { accessToken: tokenB } = await registerAndLogin(userB);

      // userA invites userB
      const inviteRes = await request(app.getHttpServer())
        .post(`/family-groups/${groupAId}/invitations`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ email: userB.email });
      expect(inviteRes.status).toBe(201);
      const inviteToken = inviteRes.body.token as string;

      // userB accepts invitation (becomes MEMBER)
      const acceptRes = await request(app.getHttpServer())
        .post(`/family-groups/invitations/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(acceptRes.status).toBe(201);
      const memberBId = acceptRes.body.id as string;

      // userB (MEMBER) tries to remove themselves or another member — must be denied
      const removeRes = await request(app.getHttpServer())
        .delete(`/family-groups/${groupAId}/members/${memberBId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect([403, 404]).toContain(removeRes.status);
    });
  });
});
