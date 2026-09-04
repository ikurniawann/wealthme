import request from "supertest";

import { createTestApp } from "./helpers/app.helper";
import { registerAndAuthenticate } from "./helpers/auth.helper";
import { cleanDatabase } from "./helpers/db.helper";

import type { PrismaService } from "../../src/prisma/prisma.service";
import type { INestApplication } from "@nestjs/common";

describe("Auth Flow (E2E)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: "auth-e2e@example.com",
    password: "SecurePass123",
    name: "Auth Test User",
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

  describe("POST /auth/register", () => {
    it("returns 201 with accessToken and refreshToken", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(typeof response.body.accessToken).toBe("string");
      expect(typeof response.body.refreshToken).toBe("string");
    });

    it("returns 400 when required fields are missing", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: "missing@example.com" });

      expect(response.status).toBe(400);
    });

    it("returns 409 or 400 when email is already taken", async () => {
      await request(app.getHttpServer()).post("/auth/register").send(testUser);

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser);

      expect([400, 409]).toContain(response.status);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post("/auth/register").send(testUser);
    });

    it("returns 200 with accessToken and refreshToken", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("returns 401 with wrong password", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: "wrong-password" });

      expect(response.status).toBe(401);
    });

    it("returns 401 with non-existent email", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: testUser.password });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    // A session token, not the JWT `/auth/register` returns: `BetterAuthGuard`
    // is the only thing guarding this route and it resolves the bearer token
    // against the `session` table. See helpers/auth.helper.ts.
    let sessionToken: string;

    beforeEach(async () => {
      ({ token: sessionToken } = await registerAndAuthenticate(
        app,
        prisma,
        testUser,
      ));
    });

    it("returns 200 with user info when Bearer token is valid", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email", testUser.email);
    });

    it("returns 401 when no token is provided", async () => {
      const response = await request(app.getHttpServer()).get("/auth/me");

      expect(response.status).toBe(401);
    });

    it("returns 401 when token is malformed", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer not-a-real-token");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      const registerRes = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser);

      refreshToken = registerRes.body.refreshToken as string;
    });

    it("returns 200 with new token pair when refreshToken is valid", async () => {
      // `JwtRefreshStrategy` extracts the token from the `refreshToken` BODY
      // field (`ExtractJwt.fromBodyField`), never from the Authorization
      // header — sending it as a bearer produced a 401 that looked like a
      // rejected token rather than a token the route never even read.
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("returns 401 when no refresh token is provided", async () => {
      const response = await request(app.getHttpServer()).post("/auth/refresh");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    let sessionToken: string;

    beforeEach(async () => {
      ({ token: sessionToken } = await registerAndAuthenticate(
        app,
        prisma,
        testUser,
      ));
    });

    it("returns 204 when logout is successful", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(response.status).toBe(204);
    });

    it("returns 401 when no token is provided", async () => {
      const response = await request(app.getHttpServer()).post("/auth/logout");

      expect(response.status).toBe(401);
    });
  });
});
