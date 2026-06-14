import * as request from "supertest";

import { createTestApp } from "./helpers/app.helper";
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

  it("full flow: register → login → create family group → create account → add transaction → list transactions", async () => {
    // Step 1: Register and login
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send(testUser);

    expect(registerRes.status).toBe(201);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.accessToken as string;

    // Step 2: Create a family group
    const groupRes = await request(app.getHttpServer())
      .post("/family-groups")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "E2E Test Family" });

    expect(groupRes.status).toBe(201);
    expect(groupRes.body).toHaveProperty("id");
    const familyGroupId = groupRes.body.id as string;

    // Step 3: Create an account in the family group
    const accountRes = await request(app.getHttpServer())
      .post(`/family-groups/${familyGroupId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "BANK",
        name: "Main Savings",
        balance: 1000000,
        currency: "IDR",
      });

    expect(accountRes.status).toBe(201);
    expect(accountRes.body).toHaveProperty("id");
    const accountId = accountRes.body.id as string;

    // Step 4: Add a transaction
    const txnRes = await request(app.getHttpServer())
      .post(`/family-groups/${familyGroupId}/transactions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        amount: 50000,
        type: "EXPENSE",
        description: "Groceries",
        occurredAt: new Date().toISOString(),
      });

    expect(txnRes.status).toBe(201);
    expect(txnRes.body).toHaveProperty("id");
    expect(txnRes.body).toHaveProperty("amount", 50000);
    expect(txnRes.body).toHaveProperty("type", "EXPENSE");

    // Step 5: List transactions — the created one must be present
    const listRes = await request(app.getHttpServer())
      .get(`/family-groups/${familyGroupId}/transactions`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);

    // Response may be an array or a paginated envelope { data: [...], total: n }
    const items: unknown[] = Array.isArray(listRes.body)
      ? (listRes.body as unknown[])
      : ((listRes.body as { data?: unknown[] }).data ?? []);

    expect(items.length).toBeGreaterThanOrEqual(1);

    const created = (items as Array<{ id: string }>).find(
      (t) => t.id === (txnRes.body as { id: string }).id,
    );
    expect(created).toBeDefined();

    // Step 6: Dashboard summary — critical flow assertion
    const dashRes = await request(app.getHttpServer())
      .get(`/family-groups/${familyGroupId}/dashboard/summary`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(dashRes.status).toBe(200);
  });

  it("returns 401 when creating a transaction without a token", async () => {
    const response = await request(app.getHttpServer())
      .post("/family-groups/some-group-id/transactions")
      .send({
        accountId: "00000000-0000-0000-0000-000000000000",
        amount: 5000,
        type: "EXPENSE",
        occurredAt: new Date().toISOString(),
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
