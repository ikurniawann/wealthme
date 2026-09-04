import request from "supertest";

import { createTestApp } from "./helpers/app.helper";
import { registerAndAuthenticate } from "./helpers/auth.helper";
import { cleanDatabase } from "./helpers/db.helper";

import type { PrismaService } from "../../src/prisma/prisma.service";
import type { INestApplication } from "@nestjs/common";

describe("Transactions Flow (E2E)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: "txn-e2e@example.com",
    password: "SecurePass123",
    name: "Transaction Test User",
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

  it("full flow: register → create family group → create account → add transaction → list transactions", async () => {
    const { token } = await registerAndAuthenticate(app, prisma, testUser);

    const groupRes = await request(app.getHttpServer())
      .post("/family-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "E2E Test Family" });

    expect(groupRes.status).toBe(201);
    expect(groupRes.body).toHaveProperty("id");
    const familyGroupId = groupRes.body.id as string;

    // Account/transaction enums are lower-case on the wire (`bank`,
    // `expense`) — matching the Prisma enums the DTOs validate against.
    const accountRes = await request(app.getHttpServer())
      .post(`/family-groups/${familyGroupId}/accounts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "bank",
        name: "Main Savings",
        balance: 1_000_000,
        currency: "IDR",
      });

    expect(accountRes.status).toBe(201);
    const accountId = accountRes.body.id as string;

    const txnRes = await request(app.getHttpServer())
      .post(`/family-groups/${familyGroupId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        amount: 50_000,
        type: "expense",
        description: "Groceries",
        occurredAt: new Date().toISOString().slice(0, 10),
      });

    expect(txnRes.status).toBe(201);
    expect(txnRes.body).toHaveProperty("id");
    expect(txnRes.body).toHaveProperty("type", "expense");

    const listRes = await request(app.getHttpServer())
      .get(`/family-groups/${familyGroupId}/transactions`)
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);

    // Response may be an array or a paginated envelope { data: [...], total: n }
    const items: unknown[] = Array.isArray(listRes.body)
      ? (listRes.body as unknown[])
      : ((listRes.body as { data?: unknown[] }).data ?? []);

    const created = (items as Array<{ id: string }>).find(
      (t) => t.id === (txnRes.body as { id: string }).id,
    );
    expect(created).toBeDefined();

    // The money actually moved: the account is down by the expense.
    const accountAfter = await request(app.getHttpServer())
      .get(`/family-groups/${familyGroupId}/accounts`)
      .set("Authorization", `Bearer ${token}`);
    const account = (
      accountAfter.body as Array<{ id: string; balance: string }>
    ).find((a) => a.id === accountId);
    expect(Number(account?.balance)).toBe(950_000);

    const dashRes = await request(app.getHttpServer())
      .get(`/family-groups/${familyGroupId}/dashboard/summary`)
      .set("Authorization", `Bearer ${token}`);

    expect(dashRes.status).toBe(200);
  });

  it("returns 401 when creating a transaction without a token", async () => {
    const response = await request(app.getHttpServer())
      .post("/family-groups/some-group-id/transactions")
      .send({
        accountId: "00000000-0000-0000-0000-000000000000",
        amount: 5000,
        type: "expense",
        occurredAt: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(401);
  });

  it("returns 401 when listing transactions without a token", async () => {
    const response = await request(app.getHttpServer()).get(
      "/family-groups/some-group-id/transactions",
    );

    expect(response.status).toBe(401);
  });
});
